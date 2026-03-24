const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const MercadoLivreAPI = require('../services/mercadolivre');
const tokenManager = require('../services/tokenManager');
const { authenticateUser } = require('../middleware/auth');

// ── DEBUG: Testar conexão com banco ─────────────────────────
router.get('/debug/db-test', async (req, res) => {
  try {
    const db = getDb();
    console.log('[DEBUG] db object:', typeof db, db.isPostgres);

    const stmt = db.prepare('SELECT 1 as test');
    console.log('[DEBUG] prepared statement:', typeof stmt);

    const result = await stmt.get();
    console.log('[DEBUG] query result:', result);

    res.json({ success: true, result, isPostgres: db.isPostgres });
  } catch (error) {
    console.error('[DEBUG] Error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// ── DEBUG: Verificar se tabelas existem ─────────────────────
router.get('/debug/check-tables', async (req, res) => {
  try {
    const db = getDb();

    // Query para listar tabelas no PostgreSQL
    const query = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    const stmt = db.prepare(query);
    const tables = await stmt.all();

    res.json({
      success: true,
      tables: tables.map(t => t.table_name),
      count: tables.length
    });
  } catch (error) {
    console.error('[DEBUG] Error checking tables:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── DEBUG: Reset completo do banco (DROP e CREATE) ──────────
router.post('/debug/reset-database', async (req, res) => {
  try {
    // Proteção simples - exigir confirmação
    if (req.body.confirm !== 'RESET_DATABASE_NOW') {
      return res.status(400).json({
        error: 'Confirmação necessária',
        message: 'Envie { "confirm": "RESET_DATABASE_NOW" } para confirmar o reset'
      });
    }

    const db = getDb();

    if (!db.isPostgres) {
      return res.status(400).json({ error: 'Only for PostgreSQL' });
    }

    console.log('[RESET] Iniciando reset completo do banco...');

    // Drop todas as tabelas
    await db.pool.query('DROP TABLE IF EXISTS answered_questions CASCADE');
    await db.pool.query('DROP TABLE IF EXISTS response_templates CASCADE');
    await db.pool.query('DROP TABLE IF EXISTS stores CASCADE');
    await db.pool.query('DROP TABLE IF EXISTS users CASCADE');
    console.log('[RESET] Tabelas removidas');

    // Recriar usando o schema
    const path = require('path');
    const fs = require('fs');
    const schemaPath = path.join(__dirname, '..', 'database', 'schema-minimal.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    const statements = schema.split(';').filter(stmt => {
      const trimmed = stmt.trim();
      return trimmed && !trimmed.startsWith('--');
    });

    for (const stmt of statements) {
      if (stmt.trim()) {
        await db.pool.query(stmt);
      }
    }

    console.log('[RESET] Schema recriado com sucesso!');
    res.json({ success: true, message: 'Database reset successfully!' });
  } catch (error) {
    console.error('[RESET] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── Registro de usuário SaaS ────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    console.log('[REGISTER] Iniciando registro:', req.body.email);

    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, senha e nome são obrigatórios' });
    }

    console.log('[REGISTER] Getting DB connection...');
    const db = getDb();
    console.log('[REGISTER] DB type:', db.isPostgres ? 'PostgreSQL' : 'SQLite');

    console.log('[REGISTER] Checking if email exists...');
    const stmt = db.prepare('SELECT id FROM users WHERE email = ?');
    const existing = await stmt.get(email);
    console.log('[REGISTER] Existing user:', existing);

    if (existing) {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }

    console.log('[REGISTER] Generating UUID and hashing password...');
    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);
    console.log('[REGISTER] UUID:', id, 'Hash length:', passwordHash.length);

    console.log('[REGISTER] Inserting user into database...');
    const insertStmt = db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)');
    const result = await insertStmt.run(id, email, passwordHash, name);
    console.log('[REGISTER] Insert result:', result);

    console.log('[REGISTER] Generating JWT token...');
    const token = jwt.sign({ id, email, name }, process.env.JWT_SECRET || 'dev-secret-key', { expiresIn: '7d' });

    console.log('[REGISTER] Registration successful!');
    res.status(201).json({ user: { id, email, name }, token });
  } catch (error) {
    console.error('[REGISTER] ERROR:', error.message);
    console.error('[REGISTER] Stack:', error.stack);
    res.status(500).json({ error: 'Erro interno', details: error.message });
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
      process.env.JWT_SECRET || 'dev-secret-key',
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
router.get('/ml/connect', authenticateUser, (req, res) => {
  const state = req.user.id; // passa o user ID no state para vincular depois
  const authUrl = MercadoLivreAPI.getAuthUrl(
    process.env.ML_APP_ID,
    process.env.ML_REDIRECT_URI,
    state
  );
  res.json({ authUrl });
});

// ── Callback OAuth do ML ────────────────────────────────────
router.get('/ml/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const userId = state; // user ID que veio no state

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/lojas?error=no_code`);
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

    res.redirect(`${process.env.FRONTEND_URL}/lojas?connected=true&store=${storeId}`);
  } catch (error) {
    console.error('Erro no callback ML:', error.response?.data || error.message);
    res.redirect(`${process.env.FRONTEND_URL}/lojas?error=auth_failed`);
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
