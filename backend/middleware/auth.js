const jwt = require('jsonwebtoken');

// Middleware: verifica JWT do sistema SaaS
function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// Middleware: verifica se a loja pertence ao usuário
async function authorizeStore(req, res, next) {
  const { getDb } = require('../config/database');
  const db = getDb();

  const storeId = req.params.storeId || req.query.storeId || req.body.storeId;
  if (!storeId) {
    return res.status(400).json({ error: 'ID da loja não fornecido' });
  }

  try {
    const store = await db.prepare('SELECT * FROM stores WHERE id = ? AND user_id = ?').get(storeId, req.user.id);
    if (!store) {
      return res.status(403).json({ error: 'Acesso negado a esta loja' });
    }

    req.store = store;
    next();
  } catch (error) {
    console.error('Erro ao verificar loja:', error.message);
    return res.status(500).json({ error: 'Erro ao verificar permissão da loja' });
  }
}

module.exports = { authenticateUser, authorizeStore };
