/**
 * Serviço de análise de anúncios
 * Lógica compartilhada entre rotas REST e ferramentas MCP
 */

const tokenManager = require('./tokenManager');
const { getDb } = require('../config/database');

class AnalyticsService {
  /**
   * Lista anúncios com baixa performance
   */
  async getWeakItems(storeId, options = {}) {
    const { minDays = 7, maxVisits = 50, maxSales = 0 } = options;

    const mlApi = await tokenManager.getApiClient(storeId);
    const db = getDb();
    const store = await db.prepare('SELECT ml_user_id FROM stores WHERE id = ?').get(storeId);

    if (!store) {
      throw new Error(`Loja ${storeId} não encontrada`);
    }

    const search = await mlApi.getSellerItems(store.ml_user_id, { status: 'active', limit: 50 });
    if (!search.results || search.results.length === 0) {
      return { items: [], total: 0, totalActive: 0 };
    }

    const items = await mlApi.getMultipleItems(search.results);

    // Busca visitas (não-crítico, pode falhar)
    let visitsMap = {};
    try {
      const visitsData = await mlApi.getItemVisits(search.results);
      if (Array.isArray(visitsData)) {
        visitsData.forEach(v => { visitsMap[v.item_id] = v.total_visits || 0; });
      }
    } catch (e) {
      console.warn('Aviso: não foi possível buscar visitas:', e.message);
    }

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

    return {
      items: weakItems,
      total: weakItems.length,
      totalActive: search.paging?.total || 0
    };
  }

  /**
   * Analisa um anúncio específico em detalhes
   */
  async analyzeItem(storeId, itemId) {
    const mlApi = await tokenManager.getApiClient(storeId);
    const item = await mlApi.getItem(itemId);

    let visits = 0;
    try {
      const v = await mlApi.getItemVisits(itemId);
      if (Array.isArray(v) && v[0]) visits = v[0].total_visits;
    } catch (e) {
      console.warn('Aviso: não foi possível buscar visitas:', e.message);
    }

    let description = '';
    try {
      const desc = await mlApi.getItemDescription(itemId);
      description = desc.plain_text || '';
    } catch (e) {
      console.warn('Aviso: não foi possível buscar descrição:', e.message);
    }

    const conv = visits > 0 ? ((item.sold_quantity || 0) / visits * 100) : 0;
    const daysActive = Math.floor((new Date() - new Date(item.date_created)) / 86400000);

    return {
      id: item.id,
      title: item.title,
      price: item.price,
      currency_id: item.currency_id,
      available_quantity: item.available_quantity,
      sold_quantity: item.sold_quantity || 0,
      visits,
      conversion_rate: Math.round(conv * 100) / 100,
      days_active: daysActive,
      status: item.status,
      photos: (item.pictures || []).length,
      listing_type: item.listing_type_id,
      condition: item.condition,
      description_length: description.length,
      permalink: item.permalink
    };
  }

  /**
   * Sugere melhorias para um anúncio
   */
  async suggestImprovements(storeId, itemId) {
    const analysis = await this.analyzeItem(storeId, itemId);
    const suggestions = [];

    if (analysis.visits < 50 && analysis.days_active > 7) {
      suggestions.push('TITULO: Melhore o titulo com palavras-chave mais buscadas. Use termos especificos do produto.');
    }
    if (analysis.photos < 5) {
      suggestions.push(`FOTOS: Adicione mais fotos (tem ${analysis.photos}, ideal e 6+). Fotos de qualidade aumentam a conversao.`);
    }
    if (analysis.description_length < 200) {
      suggestions.push('DESCRICAO: A descricao esta curta. Detalhe especificacoes, beneficios e diferenciais.');
    }
    if (analysis.conversion_rate < 1 && analysis.visits > 100) {
      suggestions.push('PRECO: A conversao esta baixa. Considere ajustar o preco ou criar promocao.');
    }
    if (analysis.listing_type === 'free') {
      suggestions.push('TIPO DE ANUNCIO: Voce esta no tipo gratuito. Considere usar Classico ou Premium para mais visibilidade.');
    }
    if (analysis.available_quantity <= 2) {
      suggestions.push('ESTOQUE: Estoque muito baixo. Aumente para nao perder vendas.');
    }

    if (suggestions.length === 0) {
      suggestions.push('O anuncio esta com boa performance! Continue monitorando.');
    }

    return { analysis, suggestions };
  }

  /**
   * Resumo de vendas do período
   */
  async getSalesSummary(storeId, days = 30) {
    const mlApi = await tokenManager.getApiClient(storeId);
    const db = getDb();
    const store = await db.prepare('SELECT ml_user_id FROM stores WHERE id = ?').get(storeId);

    if (!store) {
      throw new Error(`Loja ${storeId} não encontrada`);
    }

    const dateFrom = new Date(Date.now() - days * 86400000).toISOString();
    const orders = await mlApi.getOrders(store.ml_user_id, {
      dateFrom,
      limit: 50
    });

    const results = orders.results || [];
    const totalSales = results.length;
    const totalRevenue = results.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const statusCount = {};
    results.forEach(o => {
      statusCount[o.status] = (statusCount[o.status] || 0) + 1;
    });

    return {
      period: `Ultimos ${days} dias`,
      total_sales: totalSales,
      total_orders_api: orders.paging?.total || totalSales,
      revenue: totalRevenue,
      by_status: statusCount
    };
  }
}

module.exports = new AnalyticsService();
