// Script para consertar o banco de dados de uma vez por todas
const { Pool } = require('pg');
require('dotenv').config();

async function fixDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔧 Consertando banco de dados...');

    // Drop todas as tabelas antigas
    await pool.query('DROP TABLE IF EXISTS oauth_states CASCADE');
    await pool.query('DROP TABLE IF EXISTS answered_questions CASCADE');
    await pool.query('DROP TABLE IF EXISTS response_templates CASCADE');
    await pool.query('DROP TABLE IF EXISTS stores CASCADE');
    await pool.query('DROP TABLE IF EXISTS users CASCADE');
    console.log('✅ Tabelas antigas removidas');

    // Criar tabelas corretas
    await pool.query(`
      CREATE TABLE users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela users criada');

    await pool.query(`
      CREATE TABLE stores (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
        ml_user_id VARCHAR(50) NOT NULL,
        ml_nickname VARCHAR(100),
        ml_email VARCHAR(255),
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela stores criada');

    console.log('🎉 Banco de dados consertado com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

// Rodar imediatamente se DATABASE_URL estiver configurada
if (process.env.DATABASE_URL) {
  fixDatabase();
} else {
  console.log('Configure DATABASE_URL no .env primeiro!');
}