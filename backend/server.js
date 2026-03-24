require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initialize } = require('./config/database');
const { authenticateUser } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ───────────────────────────────────────────────
app.use(cors({
  origin: [
    'https://ml-gestao.vercel.app',
    'http://localhost:3000',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));
app.use(express.json());

// ── Rotas ───────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/items', require('./routes/items'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/metrics', require('./routes/metrics'));

// ── MCP endpoint (para ferramentas IA) ──────────────────────
const mcpTools = require('./mcp/tools');

app.post('/api/mcp/execute', authenticateUser, async (req, res) => {
  try {
    const { tool, params } = req.body;

    if (!tool || !mcpTools[tool]) {
      return res.status(400).json({
        error: `Ferramenta "${tool}" não encontrada`,
        available_tools: Object.keys(mcpTools)
      });
    }

    const result = await mcpTools[tool](params);
    res.json({ success: true, tool, result });
  } catch (error) {
    console.error(`Erro MCP [${req.body.tool}]:`, error.response?.data || error.message);
    res.status(500).json({
      error: `Erro ao executar ${req.body.tool}`,
      details: error.response?.data || error.message
    });
  }
});

// Lista ferramentas disponíveis
app.get('/api/mcp/tools', authenticateUser, (req, res) => {
  const tools = [
    { name: 'listar_anuncios_fracos', description: 'Lista anúncios com baixa performance', params: ['storeId', 'minDays?', 'maxVisits?', 'maxSales?'] },
    { name: 'analisar_anuncio', description: 'Analisa um anúncio em detalhes', params: ['storeId', 'itemId'] },
    { name: 'sugerir_melhorias', description: 'Sugere melhorias para um anúncio', params: ['storeId', 'itemId'] },
    { name: 'alterar_preco', description: 'Altera o preço de um anúncio', params: ['storeId', 'itemId', 'novoPreco'] },
    { name: 'pausar_anuncio', description: 'Pausa um anúncio', params: ['storeId', 'itemId'] },
    { name: 'reativar_anuncio', description: 'Reativa um anúncio pausado', params: ['storeId', 'itemId'] },
    { name: 'republicar_anuncio', description: 'Fecha e cria cópia do anúncio', params: ['storeId', 'itemId'] },
    { name: 'resumo_vendas', description: 'Resumo de vendas do período', params: ['storeId', 'dias?'] },
    { name: 'cadastrar_produto', description: 'Cadastra um novo produto', params: ['storeId', 'titulo', 'preco', 'estoque?', 'categoria?', 'descricao?', 'fotos?'] }
  ];
  res.json({ tools });
});

// ── Health check ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    env: process.env.NODE_ENV || 'development',
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    port: process.env.PORT || PORT
  });
});

// ── Start ───────────────────────────────────────────────────
async function start() {
  try {
    console.log('🔄 Iniciando servidor...');
    console.log('📊 Ambiente:', process.env.NODE_ENV || 'development');
    console.log('🔌 Porta:', PORT);
    console.log('🔗 DATABASE_URL presente:', !!process.env.DATABASE_URL);

    // Validar variáveis obrigatórias
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-this-to-a-random-string-minimum-32-chars') {
      throw new Error('JWT_SECRET não configurado! Gere uma chave segura com: openssl rand -base64 32');
    }

    // Inicializar banco de dados (obrigatório!)
    if (process.env.SKIP_DB_INIT !== 'true') {
      console.log('🔄 Tentando inicializar banco de dados...');
      await initialize(); // Se falhar, servidor deve crashar!
      console.log('✅ Banco de dados inicializado');
    } else {
      console.log('⏭️ Pulando inicialização do banco (SKIP_DB_INIT=true)');
    }

    // Iniciar servidor
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n✅ ML Gestão Backend ONLINE`);
      console.log(`🌐 URL: ${process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${PORT}`}`);
      console.log(`📋 Health: /api/health`);
      console.log(`🔑 OAuth ML: /api/auth/ml/connect\n`);
    });
  } catch (error) {
    console.error('❌ Erro fatal ao iniciar servidor:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

start();
