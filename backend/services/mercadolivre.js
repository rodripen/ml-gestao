const axios = require('axios');

const ML_API_BASE = 'https://api.mercadolibre.com';
const ML_AUTH_URL = 'https://auth.mercadolivre.com.br/authorization';

class MercadoLivreAPI {
  constructor(accessToken) {
    this.client = axios.create({
      baseURL: ML_API_BASE,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  // ── Autenticação ──────────────────────────────────────────

  static getAuthUrl(appId, redirectUri, state = '') {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: appId,
      redirect_uri: redirectUri,
      state
    });
    return `${ML_AUTH_URL}?${params.toString()}`;
  }

  static async exchangeCodeForToken(code, appId, secret, redirectUri) {
    const response = await axios.post(`${ML_API_BASE}/oauth/token`, {
      grant_type: 'authorization_code',
      client_id: appId,
      client_secret: secret,
      code,
      redirect_uri: redirectUri
    });
    return response.data;
  }

  static async refreshAccessToken(refreshToken, appId, secret) {
    const response = await axios.post(`${ML_API_BASE}/oauth/token`, {
      grant_type: 'refresh_token',
      client_id: appId,
      client_secret: secret,
      refresh_token: refreshToken
    });
    return response.data;
  }

  // ── Usuário ───────────────────────────────────────────────

  async getMe() {
    const { data } = await this.client.get('/users/me');
    return data;
  }

  async getUserInfo(userId) {
    const { data } = await this.client.get(`/users/${userId}`);
    return data;
  }

  // ── Anúncios (Items) ─────────────────────────────────────

  async getSellerItems(sellerId, options = {}) {
    const { offset = 0, limit = 50, status } = options;
    const params = { offset, limit };
    if (status) params.status = status;

    const { data } = await this.client.get(`/users/${sellerId}/items/search`, { params });
    return data;
  }

  async getItem(itemId) {
    const { data } = await this.client.get(`/items/${itemId}`);
    return data;
  }

  async getMultipleItems(itemIds) {
    // API aceita até 20 IDs por vez
    const chunks = [];
    for (let i = 0; i < itemIds.length; i += 20) {
      chunks.push(itemIds.slice(i, i + 20));
    }

    const results = [];
    for (const chunk of chunks) {
      const ids = chunk.join(',');
      const { data } = await this.client.get(`/items`, {
        params: { ids, attributes: 'id,title,price,available_quantity,sold_quantity,status,thumbnail,permalink,condition,listing_type_id,date_created' }
      });
      results.push(...data);
    }
    return results;
  }

  async getItemDescription(itemId) {
    const { data } = await this.client.get(`/items/${itemId}/description`);
    return data;
  }

  async createItem(itemData) {
    const { data } = await this.client.post('/items', itemData);
    return data;
  }

  async updateItem(itemId, updates) {
    const { data } = await this.client.put(`/items/${itemId}`, updates);
    return data;
  }

  async changeItemStatus(itemId, status) {
    // status: 'active', 'paused', 'closed'
    return this.updateItem(itemId, { status });
  }

  async duplicateItem(itemId) {
    const original = await this.getItem(itemId);
    const originalStatus = original.status;

    // Método 1: Close + Relist (forma oficial do ML)
    try {
      // Relist exige que o item esteja closed
      if (originalStatus !== 'closed') {
        await this.changeItemStatus(itemId, 'closed');
      }

      const relistData = {
        listing_type_id: original.listing_type_id,
        price: original.price,
        quantity: original.available_quantity || 1
      };
      const { data } = await this.client.post(`/items/${itemId}/relist`, relistData);
      console.log('✅ Duplicado via relist:', data.id);

      // Reativa o item original se estava ativo/pausado
      if (originalStatus === 'active' || originalStatus === 'paused') {
        try {
          await this.changeItemStatus(itemId, originalStatus);
        } catch (e) {
          console.log('Aviso: não foi possível reativar o original:', e.message);
        }
      }

      return data;
    } catch (relistError) {
      console.log('Relist falhou:', relistError.response?.data?.message || relistError.message);
      // Tenta reativar o original se fechamos e o relist falhou
      if (originalStatus !== 'closed') {
        try { await this.changeItemStatus(itemId, originalStatus); } catch (e) {}
      }
    }

    // Método 2: Criar cópia (fallback)
    try {
      // Extrai family_name dos atributos do item
      const familyAttr = (original.attributes || []).find(a =>
        a.id === 'FAMILY_NAME' || a.id === 'ITEM_FAMILY_NAME'
      );

      const newItem = {
        title: original.title,
        category_id: original.category_id,
        price: original.price,
        currency_id: original.currency_id,
        available_quantity: original.available_quantity || 1,
        buying_mode: original.buying_mode,
        condition: original.condition,
        listing_type_id: original.listing_type_id,
      };

      // Adiciona family_name se encontrado
      if (familyAttr?.value_name) {
        newItem.family_name = familyAttr.value_name;
      } else if (original.title) {
        // Usa o título como family_name (fallback aceito pelo ML)
        newItem.family_name = original.title;
      }

      // Copia atributos seguros
      const filteredAttrs = (original.attributes || []).filter(attr => {
        if (!attr.value_id && !attr.value_name) return false;
        const tags = attr.tags || {};
        return !tags.read_only && !tags.fixed;
      });
      if (filteredAttrs.length > 0) newItem.attributes = filteredAttrs;

      if (original.pictures?.length > 0) {
        newItem.pictures = original.pictures.map(p => ({ source: p.secure_url || p.url }));
      }
      if (original.shipping) {
        newItem.shipping = {
          mode: original.shipping.mode,
          local_pick_up: original.shipping.local_pick_up,
          free_shipping: original.shipping.free_shipping
        };
      }
      if (original.channels) newItem.channels = original.channels;
      if (original.sale_terms) {
        newItem.sale_terms = original.sale_terms.filter(t => t.value_name);
      }

      const result = await this.createItem(newItem);
      console.log('✅ Duplicado via create:', result.id);
      return result;
    } catch (createError) {
      console.log('Create falhou:', JSON.stringify(createError.response?.data || createError.message));
      throw createError;
    }
  }

  // ── Pedidos (Orders) ──────────────────────────────────────

  async getOrders(sellerId, options = {}) {
    const { offset = 0, limit = 50, status, dateFrom, dateTo } = options;
    const params = {
      seller: sellerId,
      offset,
      limit,
      sort: 'date_desc'
    };
    if (status) params['order.status'] = status;
    if (dateFrom) params['order.date_created.from'] = dateFrom;
    if (dateTo) params['order.date_created.to'] = dateTo;

    const { data } = await this.client.get('/orders/search', { params });
    return data;
  }

  async getOrder(orderId) {
    const { data } = await this.client.get(`/orders/${orderId}`);
    return data;
  }

  // ── Visitas ───────────────────────────────────────────────

  async getItemVisits(itemIds) {
    // Aceita múltiplos IDs separados por vírgula
    const ids = Array.isArray(itemIds) ? itemIds.join(',') : itemIds;
    const { data } = await this.client.get(`/visits/items`, {
      params: { ids }
    });
    return data;
  }

  async getItemVisitsTimeSeries(itemId, dateFrom, dateTo) {
    const { data } = await this.client.get(`/visits/items`, {
      params: {
        ids: itemId,
        date_from: dateFrom,
        date_to: dateTo,
        unit: 'day'
      }
    });
    return data;
  }

  // ── Categorias ────────────────────────────────────────────

  async predictCategory(title) {
    const { data } = await this.client.get(`/sites/MLB/domain_discovery/search`, {
      params: { q: title }
    });
    return data;
  }

  async getCategoryAttributes(categoryId) {
    const { data } = await this.client.get(`/categories/${categoryId}/attributes`);
    return data;
  }
}

module.exports = MercadoLivreAPI;
