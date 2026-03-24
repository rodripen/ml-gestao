// Configuração do banco de dados PostgreSQL
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Configurações para diferentes ambientes
const dbConfig = {
  // Desenvolvimento local
  development: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'ml_gestao_dev',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 20, // máximo de conexões no pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },

  // Produção - Recomendado usar serviços como:
  // - Supabase (https://supabase.com) - GRÁTIS até 500MB
  // - Neon (https://neon.tech) - GRÁTIS até 3GB
  // - Railway (https://railway.app)
  // - Render (https://render.com)
  production: {
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    max: 50,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  }
};

// Classe principal do banco de dados
class Database {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      const env = process.env.NODE_ENV || 'development';
      const config = dbConfig[env];

      this.pool = new Pool(config);

      // Testar conexão
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();

      console.log('✅ Conectado ao PostgreSQL:', result.rows[0].now);
      this.isConnected = true;

      return true;
    } catch (error) {
      console.error('❌ Erro ao conectar ao PostgreSQL:', error.message);
      throw error;
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      console.log('Desconectado do PostgreSQL');
    }
  }

  // Query simples
  async query(text, params) {
    if (!this.isConnected) {
      await this.connect();
    }
    return this.pool.query(text, params);
  }

  // Query com transação
  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Executar arquivo SQL
  async executeSQLFile(filePath) {
    try {
      const sql = await fs.readFile(filePath, 'utf8');

      // Dividir por comandos (considerando que cada comando termina com ;)
      const commands = sql
        .split(';')
        .map(cmd => cmd.trim())
        .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

      console.log(`Executando ${commands.length} comandos SQL...`);

      for (const command of commands) {
        try {
          await this.query(command);
        } catch (error) {
          // Ignorar erros de "já existe" durante criação
          if (!error.message.includes('already exists')) {
            console.error('Erro no comando:', command.substring(0, 50) + '...');
            throw error;
          }
        }
      }

      console.log('✅ Arquivo SQL executado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao executar arquivo SQL:', error.message);
      throw error;
    }
  }

  // Migração inicial
  async runMigrations() {
    try {
      console.log('🔄 Executando migrações...');

      // Criar tabela de controle de migrações
      await this.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Verificar se schema principal já foi executado
      const { rows } = await this.query(
        "SELECT * FROM migrations WHERE name = 'initial_schema'"
      );

      if (rows.length === 0) {
        // Executar schema inicial
        const schemaPath = path.join(__dirname, 'schema-postgresql.sql');
        await this.executeSQLFile(schemaPath);

        // Registrar migração
        await this.query(
          "INSERT INTO migrations (name) VALUES ('initial_schema')"
        );

        console.log('✅ Schema inicial criado com sucesso');
      } else {
        console.log('ℹ️ Schema já existe, pulando migração inicial');
      }

      // Aqui você pode adicionar outras migrações no futuro
      // await this.runMigration('add_new_feature', 'migrations/002_new_feature.sql');

    } catch (error) {
      console.error('❌ Erro nas migrações:', error.message);
      throw error;
    }
  }

  // Helpers para queries comuns
  async findOne(table, conditions) {
    const keys = Object.keys(conditions);
    const values = Object.values(conditions);
    const whereClause = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');

    const query = `SELECT * FROM ${table} WHERE ${whereClause} LIMIT 1`;
    const { rows } = await this.query(query, values);

    return rows[0] || null;
  }

  async findMany(table, conditions = {}, options = {}) {
    let query = `SELECT * FROM ${table}`;
    const values = [];

    if (Object.keys(conditions).length > 0) {
      const keys = Object.keys(conditions);
      const whereClause = keys.map((key, i) => {
        values.push(conditions[key]);
        return `${key} = $${i + 1}`;
      }).join(' AND ');
      query += ` WHERE ${whereClause}`;
    }

    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy}`;
    }

    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    if (options.offset) {
      query += ` OFFSET ${options.offset}`;
    }

    const { rows } = await this.query(query, values);
    return rows;
  }

  async insert(table, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const query = `
      INSERT INTO ${table} (${keys.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

    const { rows } = await this.query(query, values);
    return rows[0];
  }

  async update(table, conditions, data) {
    const dataKeys = Object.keys(data);
    const dataValues = Object.values(data);
    const condKeys = Object.keys(conditions);
    const condValues = Object.values(conditions);

    const setClause = dataKeys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    const whereClause = condKeys.map((key, i) =>
      `${key} = $${dataKeys.length + i + 1}`
    ).join(' AND ');

    const query = `
      UPDATE ${table}
      SET ${setClause}
      WHERE ${whereClause}
      RETURNING *
    `;

    const { rows } = await this.query(query, [...dataValues, ...condValues]);
    return rows;
  }

  async delete(table, conditions) {
    const keys = Object.keys(conditions);
    const values = Object.values(conditions);
    const whereClause = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');

    const query = `DELETE FROM ${table} WHERE ${whereClause} RETURNING *`;
    const { rows } = await this.query(query, values);

    return rows;
  }

  // Helpers específicos para o sistema
  async saveQuestion(questionData) {
    return this.insert('qa_history', questionData);
  }

  async updateQuestionResponse(questionId, responseData) {
    return this.update(
      'qa_history',
      { ml_question_id: questionId },
      responseData
    );
  }

  async getKnowledgeForStore(storeId, type = null, identifier = null) {
    let conditions = { store_id: storeId, is_active: true };

    if (type) conditions.knowledge_type = type;
    if (identifier) conditions.group_identifier = identifier;

    return this.findMany('ai_knowledge_base', conditions, {
      orderBy: 'priority DESC'
    });
  }

  async getSKUHistory(sku, storeId) {
    const query = `
      SELECT
        COUNT(*) as total_issues,
        COUNT(*) FILTER (WHERE type = 'claim') as claims,
        COUNT(*) FILTER (WHERE type = 'return') as returns,
        AVG(cost_to_seller) as avg_cost,
        STRING_AGG(DISTINCT issue_reason, ', ') as reasons
      FROM post_sales_issues
      WHERE item_sku = $1
        AND store_id = $2
        AND created_at > CURRENT_DATE - INTERVAL '90 days'
    `;

    const { rows } = await this.query(query, [sku, storeId]);
    return rows[0];
  }

  async getQAPerformance(storeId, days = 30) {
    const query = `
      SELECT
        COUNT(*) as total_questions,
        COUNT(*) FILTER (WHERE response_method LIKE 'ai%') as ai_answered,
        AVG(response_confidence) as avg_confidence,
        AVG(response_time_seconds) as avg_response_time,
        COUNT(*) FILTER (WHERE resulted_in_sale = true) * 100.0 / COUNT(*) as conversion_rate
      FROM qa_history
      WHERE store_id = $1
        AND created_at > CURRENT_DATE - INTERVAL '${days} days'
    `;

    const { rows } = await this.query(query, [storeId]);
    return rows[0];
  }
}

// Singleton
let database = null;

function getDatabase() {
  if (!database) {
    database = new Database();
  }
  return database;
}

module.exports = {
  Database,
  getDatabase
};