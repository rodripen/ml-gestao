const express = require('express');
const router = express.Router();
const { authenticateUser, authorizeStore } = require('../middleware/auth');
const tokenManager = require('../services/tokenManager');

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
    const mlApi = await tokenManager.getApiClient(req.params.storeId);
    const sellerId = req.store.ml_user_id;

    // Busca todos os anúncios ativos
    const search = await mlApi.getSellerItems(sellerId, { status: 'active', limit: 50 });
    if (!search.results || search.results.length === 0) {
      return res.json({ weakItems: [], total: 0 });
    }

    // Busca detalhes de todos
    const items = await mlApi.getMultipleItems(search.results);

    // Busca visitas
    let visitsMap = {};
    try {
      const visitsData = await mlApi.getItemVisits(search.results);
      if (Array.isArray(visitsData)) {
        visitsData.forEach(v => { visitsMap[v.item_id] = v.total_visits || 0; });
      }
    } catch (e) {}

    // Analisa performance
    const { minDays = 7, maxVisits = 50, maxSales = 0 } = req.query;
    const now = new Date();

    const weakItems = items
      .map(item => {
        const body = item.body;
        if (!body) return null;

        const created = new Date(body.date_created);
        const daysActive = Math.floor((now - created) / (1000 * 60 * 60 * 24));
        const visits = visitsMap[body.id] || 0;
        const soldQty = body.sold_quantity || 0;
        const conversionRate = visits > 0 ? (soldQty / visits * 100) : 0;

        // Critérios de "fraco"
        const reasons = [];
        if (daysActive >= parseInt(minDays) && soldQty <= parseInt(maxSales)) {
          reasons.push('sem_vendas');
        }
        if (daysActive >= parseInt(minDays) && visits <= parseInt(maxVisits)) {
          reasons.push('poucas_visitas');
        }
        if (conversionRate < 1 && visits > 50) {
          reasons.push('ctr_baixo');
        }
        if (body.available_quantity <= 2 && body.available_quantity > 0) {
          reasons.push('estoque_baixo');
        }
        if (body.available_quantity === 0) {
          reasons.push('sem_estoque');
        }

        if (reasons.length === 0) return null;

        return {
          id: body.id,
          title: body.title,
          price: body.price,
          currency_id: body.currency_id,
          available_quantity: body.available_quantity,
          sold_quantity: soldQty,
          visits,
          conversion_rate: Math.round(conversionRate * 100) / 100,
          days_active: daysActive,
          thumbnail: body.thumbnail,
          permalink: body.permalink,
          reasons
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.visits - b.visits);

    res.json({ weakItems, total: weakItems.length });
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
