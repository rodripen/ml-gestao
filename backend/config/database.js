const { Pool } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db;
let pool;
const isProduction = process.env.NODE_ENV === 'production';
const usePostgres = process.env.DATABASE_URL || isProduction;

// ────────────────────────────────────────────────────────────
// PostgreSQL Connection
// ────────────────────────────────────────────────────────────
function getPostgresPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('railway') || process.env.DATABASE_URL?.includes('supabase')
        ? { rejectUnauthorized: false }
        : false
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
    });
  }
  return pool;
}

// ────────────────────────────────────────────────────────────
// SQLite Connection (desenvolvimento)
// ────────────────────────────────────────────────────────────
function getSQLiteDb() {
  if (!db) {
    const DB_PATH = path.join(__dirname, '..', 'data.db');
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Inicializa schema SQLite
    const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      db.exec(schema);
    }
  }
  return db;
}

// ────────────────────────────────────────────────────────────
// Helper: Converte SQL com ? para PostgreSQL ($1, $2, ...)
// ────────────────────────────────────────────────────────────
function convertSQLToPostgres(sql) {
  let count = 0;
  return sql.replace(/\?/g, () => `$${++count}`);
}

// ────────────────────────────────────────────────────────────
// Unified Database Interface
// ────────────────────────────────────────────────────────────
function getDb() {
  if (usePostgres) {
    const pgPool = getPostgresPool();

    // Wrapper para ter API similar ao SQLite
    return {
      prepare: (sql) => {
        const pgSql = convertSQLToPostgres(sql);
        return {
          get: async (...params) => {
            const result = await pgPool.query(pgSql, params);
            return result.rows[0] || null;
          },
          all: async (...params) => {
            const result = await pgPool.query(pgSql, params);
            return result.rows;
          },
          run: async (...params) => {
            const result = await pgPool.query(pgSql, params);
            return { changes: result.rowCount };
          }
        };
      },
      query: async (sql, params = []) => {
        const pgSql = convertSQLToPostgres(sql);
        return await pgPool.query(pgSql, params);
      },
      exec: async (sql) => {
        const pgSql = convertSQLToPostgres(sql);
        return await pgPool.query(pgSql);
      },
      pool: pgPool,
      isPostgres: true
    };
  } else {
    return getSQLiteDb();
  }
}

// ────────────────────────────────────────────────────────────
// Inicialização do PostgreSQL
// ────────────────────────────────────────────────────────────
async function initializePostgres() {
  console.log('🔄 Verificando conexão PostgreSQL...');

  try {
    const pgPool = getPostgresPool();

    // Teste de conexão primeiro
    const client = await pgPool.connect();
    console.log('✅ Conectado ao PostgreSQL com sucesso!');

    // Se RECREATE_SCHEMA=true, dropar todas as tabelas primeiro
    if (process.env.RECREATE_SCHEMA === 'true') {
      console.log('🔄 RECREATE_SCHEMA=true - Dropando tabelas antigas...');
      try {
        await client.query('DROP TABLE IF EXISTS answered_questions CASCADE');
        await client.query('DROP TABLE IF EXISTS response_templates CASCADE');
        await client.query('DROP TABLE IF EXISTS stores CASCADE');
        await client.query('DROP TABLE IF EXISTS users CASCADE');
        console.log('✅ Tabelas antigas removidas!');
      } catch (err) {
        console.error('⚠️  Erro ao dropar tabelas (pode ser normal se não existirem):', err.message);
      }
    }

    // Usar schema mínimo para evitar problemas com extensões no Railway
    const schemaPath = path.join(__dirname, '..', 'database', 'schema-minimal.sql');

    if (!fs.existsSync(schemaPath)) {
      console.warn('⚠️  Schema PostgreSQL não encontrado em:', schemaPath);
      client.release();
      return;
    }

    const schema = fs.readFileSync(schemaPath, 'utf-8');

    //  Split statements respecting $$ dollar-quoted strings
    function splitSQLStatements(sql) {
      const statements = [];
      let current = '';
      let inDollarQuote = false;
      let dollarQuoteTag = null;

      for (let i = 0; i < sql.length; i++) {
        const char = sql[i];
        const remaining = sql.substring(i);

        // Check for start/end of dollar quote
        if (remaining.startsWith('$$') || (remaining.startsWith('$') && remaining.match(/^\$\w*\$/))) {
          const match = remaining.match(/^(\$\w*\$)/);
          if (match) {
            const tag = match[1];
            current += tag;
            i += tag.length - 1;

            if (!inDollarQuote) {
              inDollarQuote = true;
              dollarQuoteTag = tag;
            } else if (tag === dollarQuoteTag) {
              inDollarQuote = false;
              dollarQuoteTag = null;
            }
            continue;
          }
        }

        current += char;

        // Split on semicolon only if not in dollar quote
        if (char === ';' && !inDollarQuote) {
          const stmt = current.trim();
          // Skip comments and CREATE EXTENSION (já executamos acima)
          if (stmt && !stmt.startsWith('--') && !stmt.toUpperCase().includes('CREATE EXTENSION')) {
            statements.push(stmt);
          }
          current = '';
        }
      }

      // Add final statement if exists
      if (current.trim() && !current.trim().startsWith('--') && !current.toUpperCase().includes('CREATE EXTENSION')) {
        statements.push(current.trim());
      }

      return statements;
    }

    const statements = splitSQLStatements(schema);
    console.log(`🔄 Executando ${statements.length} statements SQL...`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        await client.query(stmt);
        if ((i + 1) % 10 === 0) {
          console.log(`   Progresso: ${i + 1}/${statements.length} statements`);
        }
      } catch (err) {
        // Se erro for "já existe", ignorar
        if (err.message.includes('already exists')) {
          continue;
        }
        console.error(`❌ Erro no statement ${i + 1}/${statements.length}:`, err.message);
        console.error('Statement preview:', stmt.substring(0, 200) + '...');
        throw err;
      }
    }

    console.log('✅ PostgreSQL inicializado com sucesso!');
    client.release();
  } catch (error) {
    console.error('❌ Erro ao conectar/inicializar PostgreSQL:', error.message);
    console.error('Código do erro:', error.code);
    console.error('DATABASE_URL presente:', !!process.env.DATABASE_URL);
    throw error;
  }
}

// ────────────────────────────────────────────────────────────
// Auto-inicialização
// ────────────────────────────────────────────────────────────
async function initialize() {
  if (usePostgres) {
    console.log('🐘 Usando PostgreSQL (produção)');
    console.log('DATABASE_URL definida:', !!process.env.DATABASE_URL);

    try {
      await initializePostgres();
    } catch (error) {
      console.error('⚠️  AVISO: Erro ao inicializar PostgreSQL, continuando sem banco:', error.message);
      // Continuar mesmo se falhar - permite debug
    }
  } else {
    console.log('💾 Usando SQLite (desenvolvimento)');
    getSQLiteDb(); // Inicializa SQLite
  }
}

// Exportar
module.exports = {
  getDb,
  initialize,
  isPostgres: usePostgres
};
