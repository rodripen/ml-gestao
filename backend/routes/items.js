const express = require('express');
const router = express.Router();
const { authenticateUser, authorizeStore } = require('../middleware/auth');
const tokenManager = require('../services/tokenManager');

// Todos os endpoints precisam de auth + loja autorizada
router.use(authenticateUser);

// ── Listar anúncios da loja ─────────────────────────────────
router.get('/:storeId', authorizeStore, async (req, res) => {
  try {
    const mlApi = await tokenManager.getApiClient(req.params.storeId);
    const { offset = 0, limit = 50, status } = req.query;

    const searchResult = await mlApi.getSellerItems(req.store.ml_user_id, {
      offset: parseInt(offset),
      limit: parseInt(limit),
      status
    });

    // Se houver IDs, busca detalhes completos
    if (searchResult.results && searchResult.results.length > 0) {
      const items = await mlApi.getMultipleItems(searchResult.results);
      
      // Busca visitas de todos os items
      let visits = {};
      try {
        const visitsData = await mlApi.getItemVisits(searchResult.results);
        if (Array.isArray(visitsData)) {
          visitsData.forEach(v => { visits[v.item_id] = v.total_visits; });
        }
      } catch (e) {
        // visitas podem falhar, não é crítico
      }

      const enrichedItems = items.map(item => ({
        ...item.body,
        visits: visits[item.body?.id] || 0
      }));

      res.json({
        items: enrichedItems,
        total: searchResult.paging?.total || enrichedItems.length,
        offset: parseInt(offset),
        limit: parseInt(limit)
      });
    } else {
      res.json({ items: [], total: 0, offset: 0, limit: parseInt(limit) });
    }
  } catch (error) {
    console.error('Erro ao listar items:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao buscar anúncios' });
  }
});

// ── Detalhes de um anúncio ──────────────────────────────────
router.get('/:storeId/:itemId', authorizeStore, async (req, res) => {
  try {
    const mlApi = await tokenManager.getApiClient(req.params.storeId);
    const item = await mlApi.getItem(req.params.itemId);
    
    let visits = 0;
    try {
      const visitsData = await mlApi.getItemVisits(req.params.itemId);
      if (Array.isArray(visitsData) && visitsData[0]) {
        visits = visitsData[0].total_visits;
      }
    } catch (e) {}

    let description = null;
    try {
      description = await mlApi.getItemDescription(req.params.itemId);
    } catch (e) {}

    res.json({ item, visits, description });
  } catch (error) {
    console.error('Erro ao buscar item:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao buscar anúncio' });
  }
});

// ── Criar anúncio ───────────────────────────────────────────
router.post('/:storeId', authorizeStore, async (req, res) => {
  try {
    const mlApi = await tokenManager.getApiClient(req.params.storeId);
    const item = await mlApi.createItem(req.body);
    res.status(201).json({ item });
  } catch (error) {
    console.error('Erro ao criar item:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao criar anúncio', details: error.response?.data });
  }
});

// ── Editar anúncio ──────────────────────────────────────────
router.put('/:storeId/:itemId', authorizeStore, async (req, res) => {
  try {
    const mlApi = await tokenManager.getApiClient(req.params.storeId);
    const item = await mlApi.updateItem(req.params.itemId, req.body);
    res.json({ item });
  } catch (error) {
    console.error('Erro ao editar item:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao editar anúncio', details: error.response?.data });
  }
});

// ── Mudar status (pausar, ativar, fechar) ───────────────────
router.put('/:storeId/:itemId/status', authorizeStore, async (req, res) => {
  try {
    const { status } = req.body; // 'active', 'paused', 'closed'
    if (!['active', 'paused', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Status inválido. Use: active, paused, closed' });
    }

    const mlApi = await tokenManager.getApiClient(req.params.storeId);
    const item = await mlApi.changeItemStatus(req.params.itemId, status);
    res.json({ item });
  } catch (error) {
    console.error('Erro ao mudar status:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao alterar status' });
  }
});

// ── Duplicar anúncio ────────────────────────────────────────
router.post('/:storeId/:itemId/duplicate', authorizeStore, async (req, res) => {
  try {
    const mlApi = await tokenManager.getApiClient(req.params.storeId);
    const newItem = await mlApi.duplicateItem(req.params.itemId);
    res.status(201).json({ item: newItem });
  } catch (error) {
    console.error('Erro ao duplicar item:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao duplicar anúncio', details: error.response?.data });
  }
});

module.exports = router;
