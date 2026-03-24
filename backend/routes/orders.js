const express = require('express');
const router = express.Router();
const { authenticateUser, authorizeStore } = require('../middleware/auth');
const tokenManager = require('../services/tokenManager');

router.use(authenticateUser);

// ── Listar pedidos da loja ──────────────────────────────────
router.get('/:storeId', authorizeStore, async (req, res) => {
  try {
    const mlApi = await tokenManager.getApiClient(req.params.storeId);
    const { offset = 0, limit = 50, status, dateFrom, dateTo } = req.query;

    const ordersData = await mlApi.getOrders(req.store.ml_user_id, {
      offset: parseInt(offset),
      limit: parseInt(limit),
      status,
      dateFrom,
      dateTo
    });

    const orders = (ordersData.results || []).map(order => ({
      id: order.id,
      status: order.status,
      total_amount: order.total_amount,
      currency_id: order.currency_id,
      date_created: order.date_created,
      date_closed: order.date_closed,
      buyer: {
        id: order.buyer?.id,
        nickname: order.buyer?.nickname
      },
      items: (order.order_items || []).map(oi => ({
        id: oi.item?.id,
        title: oi.item?.title,
        quantity: oi.quantity,
        unit_price: oi.unit_price,
        variation_id: oi.item?.variation_id
      })),
      shipping: order.shipping ? {
        id: order.shipping.id
      } : null
    }));

    res.json({
      orders,
      total: ordersData.paging?.total || orders.length,
      offset: parseInt(offset),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Erro ao listar pedidos:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao buscar pedidos' });
  }
});

// ── Detalhes de um pedido ───────────────────────────────────
router.get('/:storeId/:orderId', authorizeStore, async (req, res) => {
  try {
    const mlApi = await tokenManager.getApiClient(req.params.storeId);
    const order = await mlApi.getOrder(req.params.orderId);
    res.json({ order });
  } catch (error) {
    console.error('Erro ao buscar pedido:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao buscar pedido' });
  }
});

module.exports = router;
