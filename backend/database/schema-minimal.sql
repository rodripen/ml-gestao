-- Schema mínimo para PostgreSQL no Railway
-- Usando VARCHAR para IDs (compatível com UUID gerado no código)

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  company_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de lojas/contas do ML
CREATE TABLE IF NOT EXISTS stores (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ml_user_id VARCHAR(50) NOT NULL,
  ml_nickname VARCHAR(100),
  ml_email VARCHAR(255),
  ml_site VARCHAR(10) DEFAULT 'MLB',
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de templates de resposta
CREATE TABLE IF NOT EXISTS response_templates (
  id VARCHAR(36) PRIMARY KEY,
  store_id VARCHAR(36) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  template TEXT NOT NULL,
  variables JSON,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de perguntas respondidas
CREATE TABLE IF NOT EXISTS answered_questions (
  id VARCHAR(36) PRIMARY KEY,
  store_id VARCHAR(36) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  question_id VARCHAR(100) NOT NULL,
  item_id VARCHAR(50) NOT NULL,
  question_text TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  answer_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  answered_by VARCHAR(50) DEFAULT 'system',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices básicos
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_stores_user_id ON stores(user_id);
CREATE INDEX IF NOT EXISTS idx_stores_ml_user_id ON stores(ml_user_id);
CREATE INDEX IF NOT EXISTS idx_response_templates_store_id ON response_templates(store_id);
CREATE INDEX IF NOT EXISTS idx_answered_questions_store_id ON answered_questions(store_id);
CREATE INDEX IF NOT EXISTS idx_answered_questions_item_id ON answered_questions(item_id);