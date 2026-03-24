const express = require('express');
const router = express.Router();
const { authenticateUser, authorizeStore } = require('../middleware/auth');
const tokenManager = require('../services/tokenManager');
const analytics = require('../services/analytics');

router.use(authenticateUser);

// ── Dashboard de métricas ───────────────────────────────────
router.get('/:storeId/dashboard', authorizeStore, async (req, res) => {
  try {
    const mlApi = await tokenManager.getApiClient(req.params.storeId);
    const sellerId = req.store.ml_user_id;

    // Busca dados em paralelo
    const [userInfo, activeItems, ordersRecent] = await Promise.all([
      mlApi.getUserInfo(sellerId),
      mlApi.getSellerItems(sellerId, { status: 'active', limit: 1 }),
      mlApi.getOrders(sellerId, { limit: 1 })
    ]);

    const reputation = userInfo.seller_reputation || {};
    const metrics = reputation.metrics || {};
    const transactions = reputation.transactions || {};

    res.json({
      seller: {
        id: userInfo.id,
        nickname: userInfo.nickname,
        reputation_level: reputation.level_id,
        power_seller: reputation.power_seller_status
      },
      totals: {
        active_items: activeItems.paging?.total || 0,
        total_sales: transactions.completed || 0,
        total_orders: ordersRecent.paging?.total || 0
      },
      reputation: {
        level: reputation.level_id,
        power_seller: reputation.power_seller_status,
        sales_completed: transactions.completed,
        ratings: transactions.ratings || {},
        claims_rate: metrics.claims?.rate || 0,
        cancellations_rate: metrics.cancellations?.rate || 0,
        delayed_rate: metrics.delayed_handling_time?.rate || 0
      }
    });
  } catch (error) {
    console.error('Erro dashboard:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao gerar dashboard' });
  }
});

// ── Anúncios fracos (baixa performance) ─────────────────────
router.get('/:storeId/weak-items', authorizeStore, async (req, res) => {
  try {
    const { minDays, maxVisits, maxSales } = req.query;
    const result = await analytics.getWeakItems(req.params.storeId, { minDays, maxVisits, maxSales });
    res.json({ weakItems: result.items, total: result.total });
  } catch (error) {
    console.error('Erro weak items:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao analisar anúncios' });
  }
});

// ── Reputação detalhada ─────────────────────────────────────
router.get('/:storeId/reputation', authorizeStore, async (req, res) => {
  try {
    const mlApi = await tokenManager.getApiClient(req.params.storeId);
    const userInfo = await mlApi.getUserInfo(req.store.ml_user_id);
    const reputation = userInfo.seller_reputation || {};

    res.json({
      level: reputation.level_id,
      power_seller: reputation.power_seller_status,
      transactions: reputation.transactions,
      metrics: reputation.metrics
    });
  } catch (error) {
    console.error('Erro reputação:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao buscar reputação' });
  }
});

module.exports = router;
