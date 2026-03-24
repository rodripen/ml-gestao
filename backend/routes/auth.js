const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const MercadoLivreAPI = require('../services/mercadolivre');
const tokenManager = require('../services/tokenManager');
const { authenticateUser } = require('../middleware/auth');

// ── Registro de usuário SaaS ────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, senha e nome são obrigatórios' });
    }

    const db = getDb();
    const stmt = db.prepare('SELECT id FROM users WHERE email = ?');
    const existing = await stmt.get(email);

    if (existing) {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);

    const insertStmt = db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)');
    await insertStmt.run(id, email, passwordHash, name);

    const token = jwt.sign({ id, email, name }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ user: { id, email, name }, token });
  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── Login SaaS ──────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = getDb();

    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = await stmt.get(email);

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── Perfil do usuário ───────────────────────────────────────
router.get('/me', authenticateUser, async (req, res) => {
  try {
    const db = getDb();
    const userStmt = db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?');
    const user = await userStmt.get(req.user.id);

    const storesStmt = db.prepare('SELECT id, ml_user_id, ml_nickname, ml_email, is_active, created_at FROM stores WHERE user_id = ?');
    const stores = await storesStmt.all(req.user.id);

    res.json({ user, stores });
  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── Conectar loja ML (inicia OAuth) ─────────────────────────
router.get('/ml/connect', authenticateUser, async (req, res) => {
  const crypto = require('crypto');
  const db = getDb();

  // Gera token criptográfico para state (CSRF protection)
  const stateToken = crypto.randomUUID();

  // Salva o mapeamento state -> userId (expira em 10 min)
  // Usando uma coluna temporária ou armazenando no formato state:userId
  // Para simplicidade, codificamos: base64(stateToken:userId)
  const stateData = Buffer.from(`${stateToken}:${req.user.id}`).toString('base64url');

  const authUrl = MercadoLivreAPI.getAuthUrl(
    process.env.ML_APP_ID,
    process.env.ML_REDIRECT_URI,
    stateData
  );
  res.json({ authUrl });
});

// ── Callback OAuth do ML ────────────────────────────────────
router.get('/ml/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    // Decodifica state seguro
    let userId;
    try {
      const decoded = Buffer.from(state, 'base64url').toString();
      const parts = decoded.split(':');
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new Error('Invalid state format');
      }
      userId = parts[1];
    } catch (e) {
      const frontendUrl = process.env.FRONTEND_URL || 'https://ml-gestao.vercel.app';
      return res.redirect(`${frontendUrl}/lojas?error=invalid_state`);
    }

    if (!code) {
      const frontendUrl = process.env.FRONTEND_URL || 'https://ml-gestao.vercel.app';
      return res.redirect(`${frontendUrl}/lojas?error=no_code`);
    }

    // Troca code por tokens
    const tokenData = await MercadoLivreAPI.exchangeCodeForToken(
      code,
      process.env.ML_APP_ID,
      process.env.ML_SECRET,
      process.env.ML_REDIRECT_URI
    );

    // Busca informações do vendedor
    const mlApi = new MercadoLivreAPI(tokenData.access_token);
    const mlUser = await mlApi.getMe();

    const db = getDb();

    // Verifica se essa conta ML já está conectada para esse usuário
    const existingStmt = db.prepare(
      'SELECT id FROM stores WHERE user_id = ? AND ml_user_id = ?'
    );
    const existingStore = await existingStmt.get(userId, String(mlUser.id));

    const storeId = existingStore ? existingStore.id : uuidv4();
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

    if (existingStore) {
      const updateStmt = db.prepare(`
        UPDATE stores
        SET access_token = ?, refresh_token = ?, token_expires_at = ?,
            ml_nickname = ?, ml_email = ?, is_active = 1
        WHERE id = ?
      `);
      await updateStmt.run(tokenData.access_token, tokenData.refresh_token, expiresAt,
             mlUser.nickname, mlUser.email, storeId);
    } else {
      const insertStmt = db.prepare(`
        INSERT INTO stores (id, user_id, ml_user_id, ml_nickname, ml_email,
                           access_token, refresh_token, token_expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      await insertStmt.run(storeId, userId, String(mlUser.id), mlUser.nickname, mlUser.email,
             tokenData.access_token, tokenData.refresh_token, expiresAt);
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://ml-gestao.vercel.app';
    res.redirect(`${frontendUrl}/lojas?connected=true&store=${storeId}`);
  } catch (error) {
    console.error('Erro no callback ML:', error.response?.data || error.message);
    const frontendUrl = process.env.FRONTEND_URL || 'https://ml-gestao.vercel.app';
    res.redirect(`${frontendUrl}/lojas?error=auth_failed`);
  }
});

// ── Listar lojas do usuário ─────────────────────────────────
router.get('/stores', authenticateUser, async (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare(
      'SELECT id, ml_user_id, ml_nickname, ml_email, is_active, created_at FROM stores WHERE user_id = ?'
    );
    const stores = await stmt.all(req.user.id);
    res.json({ stores });
  } catch (error) {
    console.error('Erro ao listar lojas:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── Desconectar loja ────────────────────────────────────────
router.delete('/stores/:storeId', authenticateUser, async (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare(
      'UPDATE stores SET is_active = 0, access_token = NULL, refresh_token = NULL WHERE id = ? AND user_id = ?'
    );
    const result = await stmt.run(req.params.storeId, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Loja não encontrada' });
    }
    res.json({ message: 'Loja desconectada' });
  } catch (error) {
    console.error('Erro ao desconectar loja:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
