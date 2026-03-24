-- =====================================================
-- SCHEMA POSTGRESQL - SISTEMA IA RESPOSTAS AVANÇADO
-- =====================================================
-- Banco otimizado para produção e multi-tenant
-- Recomendado: PostgreSQL 14+ ou Supabase

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para busca fuzzy

-- =====================================================
-- TABELAS CORE - MULTI-TENANT
-- =====================================================

-- Usuários do sistema (tenants)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  company_name VARCHAR(255),

  -- Controle
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;

-- Lojas/Contas do Mercado Livre
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Dados do ML
  ml_user_id VARCHAR(50) NOT NULL,
  ml_nickname VARCHAR(100),
  ml_email VARCHAR(255),
  ml_site VARCHAR(10) DEFAULT 'MLB',

  -- Tokens
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,

  -- Configurações
  is_active BOOLEAN DEFAULT true,
  is_primary BOOLEAN DEFAULT false, -- Loja principal do usuário

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_sync_at TIMESTAMP WITH TIME ZONE
);

-- Índices
CREATE INDEX idx_stores_user ON stores(user_id);
CREATE INDEX idx_stores_ml_user ON stores(ml_user_id);
CREATE INDEX idx_stores_active ON stores(is_active) WHERE is_active = true;

-- =====================================================
-- SISTEMA DE IA - PERGUNTAS E RESPOSTAS
-- =====================================================

-- Base de conhecimento para treinamento da IA
CREATE TABLE IF NOT EXISTS ai_knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Tipo e grupo
  knowledge_type VARCHAR(50) NOT NULL, -- 'category', 'sku_group', 'brand', 'global'
  group_identifier VARCHAR(100) NOT NULL, -- ID da categoria, SKU, marca, etc

  -- Regra
  rule_name VARCHAR(255) NOT NULL,
  rule_content TEXT NOT NULL,
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),

  -- Exemplos (JSONB para flexibilidade)
  example_questions JSONB DEFAULT '[]'::jsonb,
  example_responses JSONB DEFAULT '[]'::jsonb,

  -- Controle
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_knowledge_store ON ai_knowledge_base(store_id);
CREATE INDEX idx_knowledge_type ON ai_knowledge_base(knowledge_type, group_identifier);
CREATE INDEX idx_knowledge_active ON ai_knowledge_base(is_active) WHERE is_active = true;

-- Grupos de SKU customizados
CREATE TABLE IF NOT EXISTS sku_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Grupo
  group_name VARCHAR(255) NOT NULL,
  group_description TEXT,
  skus JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array de SKUs

  -- Configurações especiais
  special_instructions TEXT,
  warranty_info TEXT,
  shipping_info TEXT,
  common_issues JSONB DEFAULT '[]'::jsonb,

  -- Controle
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_sku_groups_store ON sku_groups(store_id);
CREATE INDEX idx_sku_groups_skus ON sku_groups USING GIN (skus);

-- Histórico completo de perguntas e respostas
CREATE TABLE IF NOT EXISTS qa_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Identificação ML
  ml_question_id VARCHAR(50) UNIQUE,
  ml_item_id VARCHAR(50) NOT NULL,

  -- Dados do item no momento
  item_sku VARCHAR(100),
  item_title TEXT,
  item_category VARCHAR(50),
  item_price DECIMAL(10, 2),
  item_data JSONB, -- Snapshot completo do item

  -- Pergunta
  question_text TEXT NOT NULL,
  question_date TIMESTAMP WITH TIME ZONE,
  buyer_nickname VARCHAR(100),
  buyer_reputation VARCHAR(20), -- 'newbie', 'regular', 'premium'

  -- Análise da pergunta
  detected_intent VARCHAR(50),
  detected_sentiment VARCHAR(20),
  detected_keywords JSONB DEFAULT '[]'::jsonb,
  detected_language VARCHAR(10) DEFAULT 'pt',

  -- Resposta
  response_text TEXT,
  response_date TIMESTAMP WITH TIME ZONE,
  response_method VARCHAR(30), -- 'ai_auto', 'ai_assisted', 'manual', 'template'
  response_confidence DECIMAL(3, 2), -- 0.00 a 1.00
  response_model VARCHAR(50), -- 'claude-3-haiku', 'claude-3-sonnet', etc

  -- Resultado e métricas
  resulted_in_sale BOOLEAN DEFAULT false,
  sale_date TIMESTAMP WITH TIME ZONE,
  buyer_feedback VARCHAR(20), -- 'helpful', 'not_helpful', null
  response_time_seconds INTEGER,

  -- Aprendizado
  was_edited BOOLEAN DEFAULT false,
  edited_response TEXT,
  edit_reason VARCHAR(100),
  edited_by UUID REFERENCES users(id),
  should_train_on BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices otimizados
CREATE INDEX idx_qa_store ON qa_history(store_id);
CREATE INDEX idx_qa_item ON qa_history(ml_item_id);
CREATE INDEX idx_qa_sku ON qa_history(item_sku) WHERE item_sku IS NOT NULL;
CREATE INDEX idx_qa_intent ON qa_history(detected_intent);
CREATE INDEX idx_qa_date ON qa_history(question_date DESC);
CREATE INDEX idx_qa_resulted_sale ON qa_history(resulted_in_sale) WHERE resulted_in_sale = true;
CREATE INDEX idx_qa_train ON qa_history(should_train_on) WHERE should_train_on = true;

-- Busca full-text
CREATE INDEX idx_qa_question_text ON qa_history USING GIN (to_tsvector('portuguese', question_text));
CREATE INDEX idx_qa_response_text ON qa_history USING GIN (to_tsvector('portuguese', response_text));

-- Templates de resposta
CREATE TABLE IF NOT EXISTS response_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Identificação
  template_name VARCHAR(255) NOT NULL,
  template_category VARCHAR(50),

  -- Condições de ativação
  trigger_conditions JSONB, -- {"keywords": ["frete"], "intent": "shipping"}
  applicable_skus JSONB DEFAULT '[]'::jsonb,
  applicable_categories JSONB DEFAULT '[]'::jsonb,

  -- Template
  template_text TEXT NOT NULL,
  variables JSONB DEFAULT '{}'::jsonb, -- Variáveis substituíveis

  -- Performance
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5, 2) DEFAULT 0,
  resulted_in_sales INTEGER DEFAULT 0,
  avg_response_rating DECIMAL(3, 2),

  -- Controle
  priority INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_templates_store ON response_templates(store_id);
CREATE INDEX idx_templates_active ON response_templates(is_active) WHERE is_active = true;
CREATE INDEX idx_templates_category ON response_templates(template_category);

-- Feedback e correções para aprendizado
CREATE TABLE IF NOT EXISTS ai_training_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  qa_history_id UUID NOT NULL REFERENCES qa_history(id) ON DELETE CASCADE,

  -- Feedback
  feedback_type VARCHAR(30) NOT NULL, -- 'correction', 'improvement', 'approval'
  original_response TEXT NOT NULL,
  corrected_response TEXT,

  -- Análise
  what_was_wrong VARCHAR(50), -- 'tone', 'information', 'grammar', 'policy'
  improvement_notes TEXT,

  -- Impacto
  should_apply_to_similar BOOLEAN DEFAULT false,
  similar_cases_pattern TEXT,

  -- Controle
  created_by UUID REFERENCES users(id),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_feedback_qa ON ai_training_feedback(qa_history_id);
CREATE INDEX idx_feedback_type ON ai_training_feedback(feedback_type);

-- =====================================================
-- REPUBLICAÇÃO E GESTÃO DE ANÚNCIOS
-- =====================================================

-- Regras de republicação
CREATE TABLE IF NOT EXISTS republication_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  rule_name VARCHAR(255) NOT NULL,
  conditions JSONB NOT NULL, -- {"days_without_sale": 60, "visits_threshold": 10}
  actions JSONB NOT NULL, -- {"close_original": true, "improve_title": true}

  -- Controle
  is_active BOOLEAN DEFAULT true,
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Histórico de republicações
CREATE TABLE IF NOT EXISTS republication_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Items
  original_item_id VARCHAR(50) NOT NULL,
  new_item_id VARCHAR(50),

  -- Mudanças
  original_title TEXT,
  new_title TEXT,
  improvements JSONB, -- Todas as melhorias aplicadas

  -- Métricas comparativas
  visits_before INTEGER DEFAULT 0,
  visits_after INTEGER DEFAULT 0,
  sales_before INTEGER DEFAULT 0,
  sales_after INTEGER DEFAULT 0,
  conversion_before DECIMAL(5, 2),
  conversion_after DECIMAL(5, 2),

  -- Status
  republication_date TIMESTAMP WITH TIME ZONE,
  success BOOLEAN DEFAULT true,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_republication_store ON republication_history(store_id);
CREATE INDEX idx_republication_original ON republication_history(original_item_id);
CREATE INDEX idx_republication_date ON republication_history(republication_date DESC);

-- Variações de títulos para testes A/B
CREATE TABLE IF NOT EXISTS title_variations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Base
  base_item_id VARCHAR(50) NOT NULL,
  base_title TEXT NOT NULL,

  -- Variação
  variation_title TEXT NOT NULL,
  variation_item_id VARCHAR(50),
  variation_type VARCHAR(30), -- 'keyword_focus', 'benefit_focus', 'urgency', etc

  -- Performance
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  sales INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5, 2) GENERATED ALWAYS AS
    (CASE WHEN clicks > 0 THEN (sales::decimal / clicks * 100) ELSE 0 END) STORED,
  performance_score DECIMAL(5, 2) DEFAULT 0,

  -- Controle
  is_active BOOLEAN DEFAULT true,
  is_winner BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_variations_store ON title_variations(store_id);
CREATE INDEX idx_variations_base ON title_variations(base_item_id);
CREATE INDEX idx_variations_performance ON title_variations(performance_score DESC);

-- =====================================================
-- PÓS-VENDA E PROBLEMAS
-- =====================================================

-- Gestão de problemas pós-venda
CREATE TABLE IF NOT EXISTS post_sales_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Identificação
  ml_resource_id VARCHAR(50) UNIQUE,
  type VARCHAR(30) NOT NULL, -- 'claim', 'return', 'mediation', 'cancellation'
  status VARCHAR(30) NOT NULL, -- 'open', 'in_progress', 'resolved', 'closed'

  -- Pedido e item
  order_id VARCHAR(50) NOT NULL,
  item_id VARCHAR(50) NOT NULL,
  item_sku VARCHAR(100),
  item_title TEXT,
  buyer_id VARCHAR(50),

  -- Detalhes do problema
  issue_reason VARCHAR(100),
  issue_description TEXT,
  buyer_message TEXT,

  -- Resolução
  resolution_type VARCHAR(30), -- 'refund', 'return', 'exchange', 'discount'
  resolution_amount DECIMAL(10, 2),
  resolution_date TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,

  -- Métricas
  response_time_hours INTEGER,
  cost_to_seller DECIMAL(10, 2),
  buyer_satisfied BOOLEAN,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Índices
CREATE INDEX idx_issues_store ON post_sales_issues(store_id);
CREATE INDEX idx_issues_sku ON post_sales_issues(item_sku) WHERE item_sku IS NOT NULL;
CREATE INDEX idx_issues_type ON post_sales_issues(type);
CREATE INDEX idx_issues_status ON post_sales_issues(status);
CREATE INDEX idx_issues_date ON post_sales_issues(created_at DESC);

-- =====================================================
-- MÉTRICAS E PERFORMANCE
-- =====================================================

-- Métricas agregadas de IA
CREATE TABLE IF NOT EXISTS ai_performance_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Contexto
  metric_type VARCHAR(30) NOT NULL, -- 'category', 'sku', 'intent', 'daily', 'weekly'
  metric_identifier VARCHAR(100),

  -- Período
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Métricas de volume
  total_questions INTEGER DEFAULT 0,
  ai_answered INTEGER DEFAULT 0,
  human_answered INTEGER DEFAULT 0,
  escalated INTEGER DEFAULT 0,

  -- Métricas de qualidade
  ai_success_rate DECIMAL(5, 2),
  avg_confidence DECIMAL(3, 2),
  avg_response_time_seconds INTEGER,
  edited_count INTEGER DEFAULT 0,

  -- Métricas de resultado
  questions_to_sales_rate DECIMAL(5, 2),
  positive_feedback_rate DECIMAL(5, 2),
  revenue_from_qa DECIMAL(12, 2),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_metrics_store ON ai_performance_metrics(store_id);
CREATE INDEX idx_metrics_period ON ai_performance_metrics(period_start, period_end);
CREATE INDEX idx_metrics_type ON ai_performance_metrics(metric_type, metric_identifier);

-- =====================================================
-- VIEWS ÚTEIS
-- =====================================================

-- View de produtos problemáticos
CREATE OR REPLACE VIEW problematic_products AS
SELECT
  store_id,
  item_sku,
  item_title,
  COUNT(*) as total_issues,
  COUNT(*) FILTER (WHERE type = 'claim') as claims,
  COUNT(*) FILTER (WHERE type = 'return') as returns,
  COUNT(*) FILTER (WHERE type = 'cancellation') as cancellations,
  AVG(cost_to_seller) as avg_cost,
  STRING_AGG(DISTINCT issue_reason, ', ') as common_reasons
FROM post_sales_issues
WHERE created_at > CURRENT_DATE - INTERVAL '90 days'
  AND item_sku IS NOT NULL
GROUP BY store_id, item_sku, item_title
HAVING COUNT(*) > 2
ORDER BY total_issues DESC;

-- View de performance de respostas por SKU
CREATE OR REPLACE VIEW sku_qa_performance AS
SELECT
  store_id,
  item_sku,
  COUNT(*) as total_questions,
  COUNT(*) FILTER (WHERE response_method LIKE 'ai%') as ai_responses,
  COUNT(*) FILTER (WHERE resulted_in_sale = true) as sales,
  AVG(response_confidence) as avg_confidence,
  AVG(response_time_seconds) as avg_response_time,
  COUNT(*) FILTER (WHERE was_edited = true) as edited_count,
  CASE
    WHEN COUNT(*) > 0
    THEN (COUNT(*) FILTER (WHERE resulted_in_sale = true)::decimal / COUNT(*) * 100)
    ELSE 0
  END as conversion_rate
FROM qa_history
WHERE item_sku IS NOT NULL
  AND created_at > CURRENT_DATE - INTERVAL '30 days'
GROUP BY store_id, item_sku;

-- =====================================================
-- TRIGGERS E FUNÇÕES
-- =====================================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em todas as tabelas com updated_at
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT table_name
        FROM information_schema.columns
        WHERE column_name = 'updated_at'
        AND table_schema = 'public'
    LOOP
        EXECUTE format('
            CREATE TRIGGER update_%I_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column()',
            t, t);
    END LOOP;
END $$;

-- Função para calcular métricas automaticamente
CREATE OR REPLACE FUNCTION calculate_daily_metrics()
RETURNS void AS $$
BEGIN
    -- Calcular métricas diárias de IA
    INSERT INTO ai_performance_metrics (
        store_id,
        metric_type,
        metric_identifier,
        period_start,
        period_end,
        total_questions,
        ai_answered,
        ai_success_rate,
        avg_confidence,
        questions_to_sales_rate
    )
    SELECT
        store_id,
        'daily' as metric_type,
        TO_CHAR(CURRENT_DATE - 1, 'YYYY-MM-DD') as metric_identifier,
        CURRENT_DATE - 1 as period_start,
        CURRENT_DATE - 1 as period_end,
        COUNT(*) as total_questions,
        COUNT(*) FILTER (WHERE response_method LIKE 'ai%') as ai_answered,
        (COUNT(*) FILTER (WHERE response_method LIKE 'ai%' AND NOT was_edited)::decimal /
         NULLIF(COUNT(*) FILTER (WHERE response_method LIKE 'ai%'), 0) * 100) as ai_success_rate,
        AVG(response_confidence) as avg_confidence,
        (COUNT(*) FILTER (WHERE resulted_in_sale = true)::decimal /
         COUNT(*) * 100) as questions_to_sales_rate
    FROM qa_history
    WHERE DATE(question_date) = CURRENT_DATE - 1
    GROUP BY store_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índices compostos para queries comuns
CREATE INDEX idx_qa_store_date ON qa_history(store_id, question_date DESC);
CREATE INDEX idx_qa_sku_sale ON qa_history(item_sku, resulted_in_sale);
CREATE INDEX idx_issues_sku_type ON post_sales_issues(item_sku, type);
CREATE INDEX idx_knowledge_store_type ON ai_knowledge_base(store_id, knowledge_type);

-- =====================================================
-- DADOS INICIAIS
-- =====================================================

-- Inserir intents padrão
INSERT INTO ai_knowledge_base (store_id, knowledge_type, group_identifier, rule_name, rule_content, priority)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'global', 'all', 'Cordialidade',
   'Sempre seja cordial e profissional nas respostas', 10),
  ('00000000-0000-0000-0000-000000000000', 'global', 'all', 'Call to Action',
   'Sempre termine com uma call-to-action para fechar a venda', 9),
  ('00000000-0000-0000-0000-000000000000', 'global', 'all', 'Transparência',
   'Se houver problemas conhecidos com o produto, seja transparente', 10)
ON CONFLICT DO NOTHING;

-- =====================================================
-- PERMISSÕES (IMPORTANTE PARA SEGURANÇA)
-- =====================================================

-- Criar role para aplicação
CREATE ROLE ml_app_user WITH LOGIN PASSWORD 'sua_senha_segura_aqui';

-- Dar permissões necessárias
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ml_app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ml_app_user;

-- Row Level Security (RLS) para multi-tenant
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_history ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY stores_isolation ON stores
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY qa_isolation ON qa_history
  FOR ALL
  USING (store_id IN (
    SELECT id FROM stores
    WHERE user_id = current_setting('app.current_user_id')::uuid
  ));

-- =====================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE qa_history IS 'Histórico completo de perguntas e respostas com análise de IA';
COMMENT ON TABLE ai_knowledge_base IS 'Base de conhecimento para treinar a IA por contexto';
COMMENT ON TABLE sku_groups IS 'Grupos customizados de SKUs com regras específicas';
COMMENT ON TABLE post_sales_issues IS 'Problemas pós-venda para análise de produtos problemáticos';
COMMENT ON TABLE title_variations IS 'Variações de títulos para testes A/B e otimização';