const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ApiClient {
  constructor() {
    this.baseUrl = API_BASE;
  }

  getToken() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ml_token');
    }
    return null;
  }

  setToken(token) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ml_token', token);
    }
  }

  clearToken() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ml_token');
    }
  }

  async request(path, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    };

    let res;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers
      });
    } catch (networkError) {
      throw new Error('Erro de conexão. Verifique sua internet e tente novamente.');
    }

    // Verifica se a resposta é JSON antes de parsear
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      if (!res.ok) {
        throw new Error(`Erro do servidor (${res.status}). Tente novamente em alguns instantes.`);
      }
      throw new Error('Resposta inesperada do servidor.');
    }

    const data = await res.json();

    // Token expirado — limpa e redireciona
    if (res.status === 401) {
      this.clearToken();
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    if (!res.ok) {
      throw new Error(data.error || `Erro na requisição (${res.status})`);
    }
    return data;
  }

  // Auth
  async register(email, password, name) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name })
    });
    this.setToken(data.token);
    return data;
  }

  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.setToken(data.token);
    return data;
  }

  async getMe() {
    return this.request('/auth/me');
  }

  async getStores() {
    return this.request('/auth/stores');
  }

  async connectML() {
    return this.request('/auth/ml/connect');
  }

  async disconnectStore(storeId) {
    return this.request(`/auth/stores/${storeId}`, { method: 'DELETE' });
  }

  // Items
  async getItems(storeId, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/items/${storeId}?${qs}`);
  }

  async getItem(storeId, itemId) {
    return this.request(`/items/${storeId}/${itemId}`);
  }

  async updateItem(storeId, itemId, data) {
    return this.request(`/items/${storeId}/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async changeItemStatus(storeId, itemId, status) {
    return this.request(`/items/${storeId}/${itemId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  async duplicateItem(storeId, itemId) {
    return this.request(`/items/${storeId}/${itemId}/duplicate`, { method: 'POST' });
  }

  // Orders
  async getOrders(storeId, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/orders/${storeId}?${qs}`);
  }

  // Metrics
  async getDashboard(storeId) {
    return this.request(`/metrics/${storeId}/dashboard`);
  }

  async getWeakItems(storeId) {
    return this.request(`/metrics/${storeId}/weak-items`);
  }

  async getReputation(storeId) {
    return this.request(`/metrics/${storeId}/reputation`);
  }

  // MCP
  async executeMcpTool(tool, params) {
    return this.request('/mcp/execute', {
      method: 'POST',
      body: JSON.stringify({ tool, params })
    });
  }

  async getMcpTools() {
    return this.request('/mcp/tools');
  }

  logout() {
    this.clearToken();
  }
}

const api = new ApiClient();
export default api;
