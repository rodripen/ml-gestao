-- Schema para SaaS multitenant multiloja
-- Usuários do sistema (tenants)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Lojas conectadas (cada usuário pode ter várias contas ML)
CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ml_user_id TEXT NOT NULL,
  ml_nickname TEXT,
  ml_email TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at DATETIME,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Histórico de anúncios (snapshots para análise de performance)
CREATE TABLE IF NOT EXISTS items_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id TEXT NOT NULL,
  ml_item_id TEXT NOT NULL,
  title TEXT,
  price REAL,
  available_quantity INTEGER,
  sold_quantity INTEGER,
  status TEXT,
  visits INTEGER DEFAULT 0,
  snapshot_date DATE DEFAULT (date('now')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Histórico de pedidos
CREATE TABLE IF NOT EXISTS orders_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id TEXT NOT NULL,
  ml_order_id TEXT NOT NULL,
  item_id TEXT,
  item_title TEXT,
  quantity INTEGER,
  unit_price REAL,
  total_amount REAL,
  status TEXT,
  buyer_nickname TEXT,
  order_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Snapshots de métricas da loja
CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id TEXT NOT NULL,
  total_items INTEGER,
  active_items INTEGER,
  paused_items INTEGER,
  total_sales INTEGER,
  total_revenue REAL,
  reputation_level TEXT,
  snapshot_date DATE DEFAULT (date('now')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);
