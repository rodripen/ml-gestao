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
// Unified Database Interface
// ────────────────────────────────────────────────────────────
function getDb() {
  if (usePostgres) {
    const pgPool = getPostgresPool();

    // Wrapper para ter API similar ao SQLite
    return {
      prepare: (sql) => ({
        get: async (...params) => {
          const result = await pgPool.query(sql, params);
          return result.rows[0] || null;
        },
        all: async (...params) => {
          const result = await pgPool.query(sql, params);
          return result.rows;
        },
        run: async (...params) => {
          const result = await pgPool.query(sql, params);
          return { changes: result.rowCount };
        }
      }),
      query: async (sql, params = []) => {
        return await pgPool.query(sql, params);
      },
      exec: async (sql) => {
        return await pgPool.query(sql);
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
  console.log('🔄 Inicializando PostgreSQL...');

  const schemaPath = path.join(__dirname, '..', 'database', 'schema-postgresql.sql');

  if (!fs.existsSync(schemaPath)) {
    console.warn('⚠️  Schema PostgreSQL não encontrado em:', schemaPath);
    return;
  }

  try {
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    const pgPool = getPostgresPool();

    // Get a client from the pool
    const client = await pgPool.connect();

    try {
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
            if (stmt && !stmt.startsWith('--')) {
              statements.push(stmt);
            }
            current = '';
          }
        }

        // Add final statement if exists
        if (current.trim()) {
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
        } catch (err) {
          console.error(`❌ Erro no statement ${i + 1}/${statements.length}:`, err.message);
          console.error('Statement preview:', stmt.substring(0, 200) + '...');
          throw err;
        }
      }

      console.log('✅ PostgreSQL inicializado com sucesso!');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Erro ao inicializar PostgreSQL:', error.message);
    throw error;
  }
}

// ────────────────────────────────────────────────────────────
// Auto-inicialização
// ────────────────────────────────────────────────────────────
async function initialize() {
  if (usePostgres) {
    console.log('🐘 Usando PostgreSQL (produção)');
    await initializePostgres();
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
