#!/usr/bin/env node

/**
 * Script de Migração do Banco de Dados
 *
 * Uso:
 *   npm run db:migrate        - Executa migrações
 *   npm run db:migrate:fresh  - Recria banco do zero
 *   npm run db:seed           - Popula com dados de teste
 */

require('dotenv').config();
const { getDatabase } = require('./config');
const path = require('path');

async function migrate() {
  console.log('========================================');
  console.log('🚀 MIGRAÇÃO DO BANCO DE DADOS');
  console.log('========================================\n');

  const db = getDatabase();

  try {
    // 1. Conectar ao banco
    console.log('📡 Conectando ao banco de dados...');
    await db.connect();

    // 2. Executar migrações
    console.log('🔄 Executando migrações...');
    await db.runMigrations();

    // 3. Verificar estrutura
    console.log('\n✅ Verificando estrutura do banco...');
    await verifyStructure(db);

    console.log('\n========================================');
    console.log('✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('========================================');

  } catch (error) {
    console.error('\n❌ ERRO NA MIGRAÇÃO:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.disconnect();
  }
}

async function verifyStructure(db) {
  // Verificar tabelas principais
  const tables = [
    'users',
    'stores',
    'qa_history',
    'ai_knowledge_base',
    'sku_groups',
    'response_templates',
    'post_sales_issues',
    'republication_history',
    'title_variations'
  ];

  console.log('Tabelas criadas:');
  for (const table of tables) {
    try {
      const result = await db.query(
        `SELECT COUNT(*) FROM ${table}`
      );
      console.log(`  ✓ ${table}: ${result.rows[0].count} registros`);
    } catch (error) {
      console.log(`  ✗ ${table}: NÃO ENCONTRADA`);
    }
  }
}

// Função para popular com dados de teste
async function seed() {
  console.log('🌱 Populando banco com dados de teste...');

  const db = getDatabase();
  await db.connect();

  try {
    // Criar usuário de teste
    const user = await db.insert('users', {
      email: 'teste@example.com',
      password_hash: '$2b$10$YourHashedPasswordHere',
      name: 'Usuário Teste',
      is_active: true
    });

    console.log('✅ Usuário de teste criado:', user.email);

    // Criar conhecimento base global
    await db.insert('ai_knowledge_base', {
      store_id: '00000000-0000-0000-0000-000000000000',
      knowledge_type: 'global',
      group_identifier: 'all',
      rule_name: 'Sempre ser cordial',
      rule_content: 'Sempre responda de forma cordial e profissional',
      priority: 10
    });

    console.log('✅ Regras base de IA criadas');

  } catch (error) {
    console.error('Erro no seed:', error.message);
  } finally {
    await db.disconnect();
  }
}

// Função para resetar banco (CUIDADO!)
async function reset() {
  console.log('⚠️  ATENÇÃO: Isso irá APAGAR todos os dados!');
  console.log('Aguardando 5 segundos... (Ctrl+C para cancelar)');

  await new Promise(resolve => setTimeout(resolve, 5000));

  const db = getDatabase();
  await db.connect();

  try {
    console.log('🗑️ Removendo todas as tabelas...');

    // Desabilitar verificação de foreign keys temporariamente
    await db.query('SET session_replication_role = replica;');

    // Listar todas as tabelas
    const result = await db.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
    `);

    // Dropar cada tabela
    for (const row of result.rows) {
      if (row.tablename !== 'migrations') {
        await db.query(`DROP TABLE IF EXISTS ${row.tablename} CASCADE`);
        console.log(`  Removida: ${row.tablename}`);
      }
    }

    // Reabilitar verificação
    await db.query('SET session_replication_role = DEFAULT;');

    // Limpar tabela de migrações
    await db.query('TRUNCATE migrations');

    console.log('✅ Banco resetado');

    // Recriar estrutura
    console.log('🔄 Recriando estrutura...');
    await db.runMigrations();

    console.log('✅ Estrutura recriada com sucesso');

  } catch (error) {
    console.error('Erro no reset:', error.message);
    process.exit(1);
  } finally {
    await db.disconnect();
  }
}

// Executar comando baseado nos argumentos
const command = process.argv[2];

switch (command) {
  case 'seed':
    seed();
    break;
  case 'reset':
    reset();
    break;
  case 'fresh':
    reset().then(() => migrate());
    break;
  default:
    migrate();
}

module.exports = { migrate, seed, reset };