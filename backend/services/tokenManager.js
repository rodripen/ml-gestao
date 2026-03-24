const { getDb } = require('../config/database');
const MercadoLivreAPI = require('./mercadolivre');

class TokenManager {
  constructor() {
    this.appId = process.env.ML_APP_ID;
    this.secret = process.env.ML_SECRET;
  }

  // Salva tokens de uma loja
  saveTokens(storeId, tokenData) {
    const db = getDb();
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

    db.prepare(`
      UPDATE stores 
      SET access_token = ?, refresh_token = ?, token_expires_at = ?
      WHERE id = ?
    `).run(tokenData.access_token, tokenData.refresh_token, expiresAt, storeId);
  }

  // Pega um token válido para a loja, renovando se necessário
  async getValidToken(storeId) {
    const db = getDb();
    const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(storeId);

    if (!store) {
      throw new Error(`Loja ${storeId} não encontrada`);
    }

    // Verifica se token ainda é válido (com margem de 5 min)
    const expiresAt = new Date(store.token_expires_at);
    const now = new Date();
    const marginMs = 5 * 60 * 1000;

    if (expiresAt.getTime() - now.getTime() > marginMs) {
      return store.access_token;
    }

    // Token expirado ou quase expirando — renova
    try {
      const tokenData = await MercadoLivreAPI.refreshAccessToken(
        store.refresh_token,
        this.appId,
        this.secret
      );
      this.saveTokens(storeId, tokenData);
      return tokenData.access_token;
    } catch (error) {
      console.error(`Erro ao renovar token da loja ${storeId}:`, error.message);
      throw new Error('Token expirado. Reconecte a loja ao Mercado Livre.');
    }
  }

  // Cria um client ML API com token válido
  async getApiClient(storeId) {
    const token = await this.getValidToken(storeId);
    return new MercadoLivreAPI(token);
  }
}

module.exports = new TokenManager();
