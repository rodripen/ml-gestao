require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initialize } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ───────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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

app.post('/api/mcp/execute', async (req, res) => {
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
app.get('/api/mcp/tools', (req, res) => {
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

// ── Teste OAuth ML (público - sem autenticação) ────────────
app.get('/api/test-ml-oauth', (req, res) => {
  const MercadoLivreAPI = require('./services/mercadolivre');
  const authUrl = MercadoLivreAPI.getAuthUrl(
    process.env.ML_APP_ID,
    process.env.ML_REDIRECT_URI,
    'test-user-id'
  );
  res.redirect(authUrl);
});

// ── Start ───────────────────────────────────────────────────
async function start() {
  try {
    // Inicializar banco de dados
    await initialize();

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`\n🚀 ML Gestão Backend rodando em http://localhost:${PORT}`);
      console.log(`📋 Ferramentas MCP: GET http://localhost:${PORT}/api/mcp/tools`);
      console.log(`🔑 OAuth ML: GET http://localhost:${PORT}/api/auth/ml/connect\n`);
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

start();
