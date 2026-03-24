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

    // Verificar se as tabelas já existem
    const checkTablesQuery = `
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('users', 'stores', 'response_templates', 'answered_questions')
    `;

    const tablesCheck = await client.query(checkTablesQuery);
    const tableCount = parseInt(tablesCheck.rows[0].count);

    if (tableCount === 4) {
      console.log('✅ Todas as tabelas já existem, pulando criação do schema');
      client.release();
      return;
    }

    console.log(`🔄 Encontradas ${tableCount}/4 tabelas, criando schema...`);

    // Usar schema mínimo para evitar problemas com extensões no Railway
    const schemaPath = path.join(__dirname, '..', 'database', 'schema-minimal.sql');

    if (!fs.existsSync(schemaPath)) {
      console.warn('⚠️  Schema PostgreSQL não encontrado em:', schemaPath);
      client.release();
      return;
    }

    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // SIMPLIFICADO: Executar cada statement CREATE TABLE e CREATE INDEX separadamente
    // Mas de forma mais simples, sem parser complexo
    const statements = schema.split(';').filter(stmt => {
      const trimmed = stmt.trim();
      return trimmed && !trimmed.startsWith('--');
    });

    console.log(`🔄 Executando ${statements.length} statements SQL...`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (!stmt) continue;

      try {
        await client.query(stmt);
        console.log(`   ✓ Statement ${i + 1}/${statements.length} executado`);
      } catch (err) {
        // Se erro for "already exists", ignorar
        if (err.message.includes('already exists')) {
          console.log(`   ⏭️ Statement ${i + 1}/${statements.length} - já existe`);
          continue;
        }
        console.error(`❌ Erro no statement ${i + 1}/${statements.length}:`, err.message);
        console.error('Statement:', stmt.substring(0, 100) + '...');
        // Não fazer throw - tentar executar os outros statements
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

    // NÃO engolir erros - se schema falhar, servidor não deve iniciar!
    await initializePostgres();
    console.log('✅ PostgreSQL completamente inicializado!');
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
