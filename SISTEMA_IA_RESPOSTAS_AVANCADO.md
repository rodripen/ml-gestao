# 🤖 SISTEMA AVANÇADO DE RESPOSTAS COM IA - TREINAMENTO E APRENDIZADO

## VISÃO GERAL
Sistema completo de IA para respostas que aprende continuamente, permite treinamento customizado por categoria/SKU e oferece controle total ao usuário.

---

## 📊 ARQUITETURA DO BANCO DE DADOS

### 1. ESTRUTURA DE TREINAMENTO E CONHECIMENTO

```sql
-- Base de conhecimento por categoria de produto
CREATE TABLE IF NOT EXISTS ai_knowledge_base (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id TEXT NOT NULL,

  -- Agrupamento
  knowledge_type TEXT NOT NULL, -- 'category', 'sku_group', 'brand', 'price_range'
  group_identifier TEXT NOT NULL, -- ID da categoria, grupo de SKUs, marca, etc

  -- Conhecimento
  rule_name TEXT NOT NULL,
  rule_content TEXT NOT NULL, -- Instrução para a IA
  priority INTEGER DEFAULT 5, -- 1-10, maior = mais importante

  -- Exemplos
  example_questions JSON, -- Perguntas exemplo
  example_responses JSON, -- Respostas exemplo

  -- Controle
  is_active BOOLEAN DEFAULT 1,
  created_by TEXT, -- user_id de quem criou
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Grupos de SKU personalizados
CREATE TABLE IF NOT EXISTS sku_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id TEXT NOT NULL,
  group_name TEXT NOT NULL, -- "Eletrônicos Importados", "Produtos Frágeis"
  group_description TEXT,
  skus JSON NOT NULL, -- ["SKU001", "SKU002", "SKU003"]

  -- Configurações especiais para o grupo
  special_instructions TEXT, -- Instruções específicas para IA
  warranty_info TEXT,
  shipping_info TEXT,
  common_issues JSON, -- Problemas comuns conhecidos

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Histórico completo de Q&A para aprendizado
CREATE TABLE IF NOT EXISTS qa_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id TEXT NOT NULL,

  -- Contexto da pergunta
  ml_question_id TEXT UNIQUE,
  item_id TEXT NOT NULL,
  item_sku TEXT,
  item_title TEXT,
  item_category TEXT,
  item_price REAL,
  item_data JSON, -- Todos os dados do anúncio no momento

  -- Pergunta
  question_text TEXT NOT NULL,
  question_date DATETIME,
  buyer_nickname TEXT,
  buyer_reputation TEXT, -- 'newbie', 'regular', 'premium'

  -- Análise da pergunta
  detected_intent TEXT, -- 'price', 'shipping', 'availability', 'technical', 'warranty'
  detected_sentiment TEXT, -- 'positive', 'neutral', 'negative', 'urgent'
  detected_keywords JSON, -- ["desconto", "frete", "garantia"]

  -- Resposta
  response_text TEXT,
  response_date DATETIME,
  response_method TEXT, -- 'ai_auto', 'ai_assisted', 'manual', 'template'
  response_confidence REAL, -- 0.0 a 1.0

  -- Resultado
  resulted_in_sale BOOLEAN DEFAULT 0,
  buyer_feedback TEXT, -- 'helpful', 'not_helpful', null
  response_time_minutes INTEGER,

  -- Aprendizado
  was_edited BOOLEAN DEFAULT 0, -- Se humano editou resposta da IA
  edited_response TEXT, -- Resposta editada (para treinar)
  edit_reason TEXT, -- Por que foi editada
  should_train_on BOOLEAN DEFAULT 1, -- Usar para treinar IA

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Templates customizados por situação
CREATE TABLE IF NOT EXISTS response_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id TEXT NOT NULL,

  -- Identificação
  template_name TEXT NOT NULL,
  template_category TEXT, -- 'greeting', 'negotiation', 'technical', 'shipping'

  -- Condições de ativação
  trigger_conditions JSON, -- {"keywords": ["frete", "envio"], "intent": "shipping"}
  applicable_skus JSON, -- SKUs específicos ou null para todos
  applicable_categories JSON, -- Categorias específicas

  -- Template
  template_text TEXT NOT NULL,
  variables JSON, -- Variáveis que podem ser substituídas

  -- Performance
  usage_count INTEGER DEFAULT 0,
  success_rate REAL DEFAULT 0,
  avg_response_rating REAL,

  -- Controle
  priority INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Feedback e correções para aprendizado
CREATE TABLE IF NOT EXISTS ai_training_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  qa_history_id INTEGER NOT NULL,

  -- Feedback
  feedback_type TEXT NOT NULL, -- 'correction', 'improvement', 'approval'
  original_response TEXT NOT NULL,
  corrected_response TEXT,

  -- Análise
  what_was_wrong TEXT, -- 'tone', 'information', 'grammar', 'policy'
  improvement_notes TEXT,

  -- Impacto
  should_apply_to_similar BOOLEAN DEFAULT 0, -- Aplicar a casos similares
  similar_cases_pattern TEXT, -- Padrão para identificar casos similares

  created_by TEXT, -- user_id
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (qa_history_id) REFERENCES qa_history(id)
);

-- Métricas de performance por contexto
CREATE TABLE IF NOT EXISTS ai_performance_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id TEXT NOT NULL,

  -- Contexto
  metric_type TEXT, -- 'category', 'sku', 'intent', 'overall'
  metric_identifier TEXT, -- ID da categoria, SKU, etc

  -- Período
  period_start DATE,
  period_end DATE,

  -- Métricas
  total_questions INTEGER DEFAULT 0,
  ai_answered INTEGER DEFAULT 0,
  human_answered INTEGER DEFAULT 0,
  ai_success_rate REAL, -- % que não precisou edição
  avg_confidence REAL,
  avg_response_time_seconds INTEGER,

  -- Resultados
  questions_to_sales_rate REAL, -- % que virou venda
  positive_feedback_rate REAL,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);
```

---

## 🎯 SISTEMA DE IA COM APRENDIZADO CONTÍNUO

### 1. MOTOR DE IA CONTEXTUALIZADA

```javascript
// backend/services/ai/contextualAI.js
class ContextualAIResponder {
  constructor(storeId) {
    this.storeId = storeId;
    this.db = getDb();
    this.knowledgeCache = new Map();
    this.loadKnowledge();
  }

  async processQuestion(question, itemId) {
    // 1. Carregar TODOS os dados do anúncio
    const itemContext = await this.loadCompleteItemContext(itemId);

    // 2. Analisar histórico de perguntas do item
    const qaHistory = await this.loadItemQAHistory(itemId);

    // 3. Carregar conhecimento específico
    const knowledge = await this.loadRelevantKnowledge(itemContext);

    // 4. Detectar intenção e sentimento
    const analysis = await this.analyzeQuestion(question, itemContext);

    // 5. Gerar resposta contextualizada
    const response = await this.generateResponse(
      question,
      itemContext,
      qaHistory,
      knowledge,
      analysis
    );

    // 6. Salvar para aprendizado
    await this.saveForLearning(question, response, itemContext, analysis);

    return response;
  }

  async loadCompleteItemContext(itemId) {
    const mlApi = await tokenManager.getApiClient(this.storeId);

    // Carregar TUDO sobre o item
    const [item, description, attributes, questions, shipping] = await Promise.all([
      mlApi.getItem(itemId),
      mlApi.getItemDescription(itemId),
      mlApi.getCategoryAttributes(item.category_id),
      mlApi.getItemQuestions(itemId),
      mlApi.getShippingOptions(itemId)
    ]);

    // Carregar histórico de problemas do SKU
    const skuIssues = await this.db.prepare(`
      SELECT
        COUNT(*) as total_issues,
        GROUP_CONCAT(issue_reason) as reasons,
        AVG(cost_to_seller) as avg_cost
      FROM post_sales_issues
      WHERE item_sku = ?
      AND created_at > date('now', '-90 days')
    `).get(item.seller_custom_field);

    // Carregar performance de vendas
    const salesPerformance = await this.db.prepare(`
      SELECT
        COUNT(*) as total_sales,
        AVG(response_time_minutes) as avg_response_time,
        COUNT(CASE WHEN resulted_in_sale = 1 THEN 1 END) * 100.0 / COUNT(*) as conversion_rate
      FROM qa_history
      WHERE item_id = ?
      AND created_at > date('now', '-30 days')
    `).get(itemId);

    return {
      item,
      description: description.plain_text,
      attributes,
      recent_questions: questions.slice(0, 10),
      shipping_options: shipping,
      sku_issues: skuIssues,
      sales_performance: salesPerformance,
      full_data: item // Guardar dados completos
    };
  }

  async loadItemQAHistory(itemId) {
    // Carregar últimas 20 perguntas e respostas do item
    const history = await this.db.prepare(`
      SELECT
        question_text,
        response_text,
        resulted_in_sale,
        detected_intent,
        response_confidence
      FROM qa_history
      WHERE item_id = ?
      AND response_text IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 20
    `).all(itemId);

    // Agrupar por intenção para análise
    const byIntent = {};
    history.forEach(qa => {
      if (!byIntent[qa.detected_intent]) {
        byIntent[qa.detected_intent] = [];
      }
      byIntent[qa.detected_intent].push(qa);
    });

    return {
      recent: history,
      by_intent: byIntent,
      successful_responses: history.filter(h => h.resulted_in_sale),
      total_questions: history.length
    };
  }

  async loadRelevantKnowledge(itemContext) {
    const knowledge = {};

    // 1. Conhecimento da categoria
    knowledge.category = await this.db.prepare(`
      SELECT rule_content, priority, example_responses
      FROM ai_knowledge_base
      WHERE store_id = ?
      AND knowledge_type = 'category'
      AND group_identifier = ?
      AND is_active = 1
      ORDER BY priority DESC
    `).all(this.storeId, itemContext.item.category_id);

    // 2. Conhecimento do grupo de SKU
    if (itemContext.item.seller_custom_field) {
      const skuGroup = await this.db.prepare(`
        SELECT * FROM sku_groups
        WHERE store_id = ?
        AND json_extract(skus, '$') LIKE ?
      `).get(this.storeId, `%${itemContext.item.seller_custom_field}%`);

      if (skuGroup) {
        knowledge.sku_group = {
          instructions: skuGroup.special_instructions,
          warranty: skuGroup.warranty_info,
          shipping: skuGroup.shipping_info,
          common_issues: JSON.parse(skuGroup.common_issues || '[]')
        };
      }
    }

    // 3. Templates relevantes
    knowledge.templates = await this.db.prepare(`
      SELECT * FROM response_templates
      WHERE store_id = ?
      AND is_active = 1
      AND (
        applicable_categories IS NULL
        OR json_extract(applicable_categories, '$') LIKE ?
      )
      ORDER BY priority DESC, success_rate DESC
    `).all(this.storeId, `%${itemContext.item.category_id}%`);

    return knowledge;
  }

  async analyzeQuestion(question, itemContext) {
    // Análise local rápida
    const localAnalysis = this.quickAnalysis(question.text);

    // Análise profunda com Claude
    const prompt = `
    Analise esta pergunta de um cliente do Mercado Livre:

    PERGUNTA: "${question.text}"

    CONTEXTO DO PRODUTO:
    - Título: ${itemContext.item.title}
    - Preço: R$ ${itemContext.item.price}
    - Categoria: ${itemContext.item.category_id}
    - Vendidos: ${itemContext.item.sold_quantity}
    - Disponível: ${itemContext.item.available_quantity}

    HISTÓRICO DO SKU:
    ${itemContext.sku_issues.total_issues > 0 ?
      `⚠️ ATENÇÃO: ${itemContext.sku_issues.total_issues} problemas reportados. Motivos: ${itemContext.sku_issues.reasons}` :
      '✅ Sem problemas reportados'}

    Retorne um JSON com:
    {
      "intent": "price|shipping|availability|technical|warranty|quality|comparison|other",
      "sub_intent": "descrição mais específica",
      "sentiment": "positive|neutral|negative|urgent",
      "key_concerns": ["lista", "de", "preocupações"],
      "required_info": ["informações", "necessárias", "na", "resposta"],
      "negotiation_detected": true/false,
      "competitor_mentioned": true/false,
      "urgency_level": 1-5,
      "suggested_approach": "friendly|professional|detailed|brief"
    }
    `;

    try {
      const claudeAnalysis = await this.callClaude(prompt);
      return { ...localAnalysis, ...JSON.parse(claudeAnalysis) };
    } catch (error) {
      console.error('Erro na análise com Claude:', error);
      return localAnalysis;
    }
  }

  async generateResponse(question, itemContext, qaHistory, knowledge, analysis) {
    // Construir prompt super contextualizado
    const prompt = this.buildContextualPrompt(
      question,
      itemContext,
      qaHistory,
      knowledge,
      analysis
    );

    try {
      const claudeResponse = await this.callClaude(prompt);
      const parsed = JSON.parse(claudeResponse);

      // Validar e ajustar resposta
      const validated = await this.validateResponse(parsed, itemContext);

      return {
        text: validated.response,
        confidence: validated.confidence,
        method: 'ai_contextual',
        analysis: analysis,
        should_escalate: validated.confidence < 0.7 || analysis.urgency_level > 4
      };

    } catch (error) {
      // Fallback para template
      return this.fallbackToTemplate(question, analysis, knowledge);
    }
  }

  buildContextualPrompt(question, itemContext, qaHistory, knowledge, analysis) {
    let prompt = `
    Você é um vendedor experiente do Mercado Livre respondendo uma pergunta.

    ANÁLISE DA PERGUNTA:
    - Intenção: ${analysis.intent} (${analysis.sub_intent})
    - Sentimento: ${analysis.sentiment}
    - Urgência: ${analysis.urgency_level}/5
    - Abordagem sugerida: ${analysis.suggested_approach}
    ${analysis.negotiation_detected ? '- NEGOCIAÇÃO DETECTADA' : ''}

    PERGUNTA: "${question.text}"

    DADOS COMPLETOS DO PRODUTO:
    - Título: ${itemContext.item.title}
    - SKU: ${itemContext.item.seller_custom_field || 'N/A'}
    - Preço: R$ ${itemContext.item.price}
    - Estoque: ${itemContext.item.available_quantity} unidades
    - Vendidos: ${itemContext.item.sold_quantity}
    - Taxa de conversão: ${itemContext.sales_performance?.conversion_rate?.toFixed(1)}%

    DESCRIÇÃO:
    ${itemContext.description?.substring(0, 500)}

    ATRIBUTOS IMPORTANTES:
    ${itemContext.attributes?.slice(0, 5).map(a => `- ${a.name}: ${a.value_name}`).join('\n')}
    `;

    // Adicionar histórico de problemas se existir
    if (itemContext.sku_issues?.total_issues > 0) {
      prompt += `

    ⚠️ HISTÓRICO DE PROBLEMAS DESTE SKU:
    - Total de problemas: ${itemContext.sku_issues.total_issues}
    - Motivos: ${itemContext.sku_issues.reasons}
    - Custo médio por problema: R$ ${itemContext.sku_issues.avg_cost}
    IMPORTANTE: Seja transparente sobre possíveis problemas conhecidos.
    `;
    }

    // Adicionar conhecimento específico
    if (knowledge.category?.length > 0) {
      prompt += `

    REGRAS DA CATEGORIA:
    ${knowledge.category.map(k => `- ${k.rule_content}`).join('\n')}
    `;
    }

    if (knowledge.sku_group) {
      prompt += `

    INSTRUÇÕES ESPECÍFICAS DESTE GRUPO DE PRODUTOS:
    ${knowledge.sku_group.instructions}
    ${knowledge.sku_group.warranty ? `Garantia: ${knowledge.sku_group.warranty}` : ''}
    ${knowledge.sku_group.shipping ? `Envio: ${knowledge.sku_group.shipping}` : ''}
    `;
    }

    // Adicionar exemplos de respostas bem-sucedidas
    if (qaHistory.successful_responses?.length > 0) {
      prompt += `

    EXEMPLOS DE RESPOSTAS QUE GERARAM VENDAS NESTE PRODUTO:
    ${qaHistory.successful_responses.slice(0, 3).map(r =>
      `P: "${r.question_text}"\nR: "${r.response_text}"`
    ).join('\n---\n')}
    `;
    }

    // Adicionar perguntas recentes para evitar repetição
    if (qaHistory.recent?.length > 0) {
      prompt += `

    PERGUNTAS RECENTES JÁ RESPONDIDAS (evite repetir informação óbvia):
    ${qaHistory.recent.slice(0, 5).map(r =>
      `P: "${r.question_text}"`
    ).join('\n')}
    `;
    }

    prompt += `

    INSTRUÇÕES FINAIS:
    1. Responda de forma ${analysis.suggested_approach}
    2. ${analysis.negotiation_detected ? 'Máximo de 5% de desconto à vista no PIX' : 'Mantenha o preço firme'}
    3. ${analysis.urgency_level > 3 ? 'Cliente parece urgente - seja rápido e direto' : 'Seja detalhado e cordial'}
    4. Se houver problemas conhecidos com o produto, seja transparente
    5. SEMPRE inclua uma call-to-action para fechar a venda

    Retorne um JSON:
    {
      "response": "sua resposta aqui",
      "confidence": 0.0 a 1.0,
      "reasoning": "por que respondeu assim",
      "information_included": ["lista", "de", "informações", "incluídas"],
      "call_to_action": "ação sugerida ao cliente"
    }
    `;

    return prompt;
  }

  async saveForLearning(question, response, itemContext, analysis) {
    await this.db.prepare(`
      INSERT INTO qa_history (
        store_id, ml_question_id, item_id, item_sku,
        item_title, item_category, item_price, item_data,
        question_text, question_date, buyer_nickname,
        detected_intent, detected_sentiment, detected_keywords,
        response_text, response_date, response_method,
        response_confidence
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      this.storeId,
      question.id,
      itemContext.item.id,
      itemContext.item.seller_custom_field,
      itemContext.item.title,
      itemContext.item.category_id,
      itemContext.item.price,
      JSON.stringify(itemContext.full_data),
      question.text,
      question.date_created,
      question.from?.nickname,
      analysis.intent,
      analysis.sentiment,
      JSON.stringify(analysis.key_concerns || []),
      response.text,
      new Date().toISOString(),
      response.method,
      response.confidence
    );
  }

  async learnFromFeedback(questionId, feedback) {
    // Atualizar histórico com feedback
    await this.db.prepare(`
      UPDATE qa_history
      SET
        was_edited = ?,
        edited_response = ?,
        edit_reason = ?,
        resulted_in_sale = ?
      WHERE ml_question_id = ?
    `).run(
      feedback.was_edited ? 1 : 0,
      feedback.edited_response,
      feedback.edit_reason,
      feedback.resulted_in_sale ? 1 : 0,
      questionId
    );

    // Se a resposta foi editada, aprender com a correção
    if (feedback.was_edited) {
      await this.createTrainingFeedback(questionId, feedback);
    }

    // Atualizar métricas de performance
    await this.updatePerformanceMetrics(questionId, feedback);
  }
}
```

---

## 🎨 PAINEL DE TREINAMENTO DA IA

### 1. INTERFACE DE CONFIGURAÇÃO

```jsx
// frontend/pages/ai-training.jsx
import { useState, useEffect } from 'react';

export default function AITrainingPanel() {
  const [activeTab, setActiveTab] = useState('knowledge');
  const [knowledgeRules, setKnowledgeRules] = useState([]);
  const [skuGroups, setSkuGroups] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [performance, setPerformance] = useState({});

  return (
    <div className="ai-training-panel">
      <h1>🧠 Central de Treinamento da IA</h1>

      <div className="tabs">
        <button onClick={() => setActiveTab('knowledge')} className={activeTab === 'knowledge' ? 'active' : ''}>
          📚 Base de Conhecimento
        </button>
        <button onClick={() => setActiveTab('groups')} className={activeTab === 'groups' ? 'active' : ''}>
          📦 Grupos de SKU
        </button>
        <button onClick={() => setActiveTab('templates')} className={activeTab === 'templates' ? 'active' : ''}>
          📝 Templates
        </button>
        <button onClick={() => setActiveTab('review')} className={activeTab === 'review' ? 'active' : ''}>
          ✏️ Revisar Respostas
        </button>
        <button onClick={() => setActiveTab('performance')} className={activeTab === 'performance' ? 'active' : ''}>
          📊 Performance
        </button>
      </div>

      {activeTab === 'knowledge' && <KnowledgeBaseTab />}
      {activeTab === 'groups' && <SKUGroupsTab />}
      {activeTab === 'templates' && <TemplatesTab />}
      {activeTab === 'review' && <ReviewResponsesTab />}
      {activeTab === 'performance' && <PerformanceTab />}
    </div>
  );
}

function KnowledgeBaseTab() {
  const [rules, setRules] = useState([]);
  const [newRule, setNewRule] = useState({
    knowledge_type: 'category',
    group_identifier: '',
    rule_name: '',
    rule_content: '',
    example_questions: [],
    example_responses: []
  });

  return (
    <div className="knowledge-base-tab">
      <div className="add-rule-section">
        <h2>Adicionar Nova Regra de Conhecimento</h2>

        <div className="form-group">
          <label>Tipo de Conhecimento:</label>
          <select
            value={newRule.knowledge_type}
            onChange={(e) => setNewRule({...newRule, knowledge_type: e.target.value})}
          >
            <option value="category">Por Categoria</option>
            <option value="sku_group">Por Grupo de SKU</option>
            <option value="brand">Por Marca</option>
            <option value="price_range">Por Faixa de Preço</option>
            <option value="global">Global (Todas)</option>
          </select>
        </div>

        <div className="form-group">
          <label>Identificador (categoria, SKU, marca):</label>
          <input
            type="text"
            value={newRule.group_identifier}
            onChange={(e) => setNewRule({...newRule, group_identifier: e.target.value})}
            placeholder="Ex: MLB1234 ou SAMSUNG"
          />
        </div>

        <div className="form-group">
          <label>Nome da Regra:</label>
          <input
            type="text"
            value={newRule.rule_name}
            onChange={(e) => setNewRule({...newRule, rule_name: e.target.value})}
            placeholder="Ex: Política de garantia para eletrônicos"
          />
        </div>

        <div className="form-group">
          <label>Instrução para a IA:</label>
          <textarea
            value={newRule.rule_content}
            onChange={(e) => setNewRule({...newRule, rule_content: e.target.value})}
            rows={4}
            placeholder="Ex: Sempre mencione que produtos eletrônicos têm garantia de 1 ano do fabricante + 90 dias do vendedor"
          />
        </div>

        <div className="form-group">
          <label>Exemplos de Perguntas (uma por linha):</label>
          <textarea
            onChange={(e) => setNewRule({...newRule, example_questions: e.target.value.split('\n')})}
            rows={3}
            placeholder="Tem garantia?&#10;Qual a garantia?&#10;E se quebrar?"
          />
        </div>

        <div className="form-group">
          <label>Exemplos de Respostas Ideais:</label>
          <textarea
            onChange={(e) => setNewRule({...newRule, example_responses: e.target.value.split('\n')})}
            rows={3}
            placeholder="Sim! Você tem 1 ano de garantia do fabricante + 90 dias nossa&#10;..."
          />
        </div>

        <button onClick={saveRule} className="btn-primary">
          💾 Salvar Regra
        </button>
      </div>

      <div className="existing-rules">
        <h2>Regras Existentes</h2>
        <div className="rules-list">
          {rules.map(rule => (
            <div key={rule.id} className="rule-card">
              <div className="rule-header">
                <span className="rule-type">{rule.knowledge_type}</span>
                <span className="rule-identifier">{rule.group_identifier}</span>
                <span className="rule-priority">Prioridade: {rule.priority}</span>
              </div>
              <h3>{rule.rule_name}</h3>
              <p>{rule.rule_content}</p>
              <div className="rule-actions">
                <button onClick={() => editRule(rule.id)}>✏️ Editar</button>
                <button onClick={() => toggleRule(rule.id)}>
                  {rule.is_active ? '⏸️ Desativar' : '▶️ Ativar'}
                </button>
                <button onClick={() => deleteRule(rule.id)}>🗑️ Excluir</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SKUGroupsTab() {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);

  return (
    <div className="sku-groups-tab">
      <div className="create-group">
        <h2>Criar Grupo de SKUs</h2>

        <div className="form-group">
          <label>Nome do Grupo:</label>
          <input
            type="text"
            placeholder="Ex: Produtos Importados, Eletrônicos Frágeis"
          />
        </div>

        <div className="form-group">
          <label>SKUs (um por linha ou separados por vírgula):</label>
          <textarea
            rows={4}
            placeholder="SKU001&#10;SKU002&#10;SKU003"
          />
        </div>

        <div className="form-group">
          <label>Instruções Especiais para este Grupo:</label>
          <textarea
            rows={4}
            placeholder="Ex: Sempre avisar que produtos importados podem ter taxas alfandegárias"
          />
        </div>

        <div className="form-group">
          <label>Informação de Garantia:</label>
          <input
            type="text"
            placeholder="Ex: 6 meses de garantia internacional"
          />
        </div>

        <div className="form-group">
          <label>Informação de Envio:</label>
          <textarea
            rows={2}
            placeholder="Ex: Envio em 15-20 dias úteis por ser importado"
          />
        </div>

        <div className="form-group">
          <label>Problemas Conhecidos (opcional):</label>
          <textarea
            rows={3}
            placeholder="Ex: Pode haver delay na entrega em dezembro"
          />
        </div>

        <button className="btn-primary">
          ➕ Criar Grupo
        </button>
      </div>

      <div className="groups-list">
        <h2>Grupos Existentes</h2>
        {groups.map(group => (
          <div key={group.id} className="group-card">
            <h3>{group.group_name}</h3>
            <p>{group.group_description}</p>
            <div className="group-stats">
              <span>📦 {JSON.parse(group.skus).length} SKUs</span>
              <span>⚠️ {JSON.parse(group.common_issues || '[]').length} problemas conhecidos</span>
            </div>
            <button onClick={() => setSelectedGroup(group)}>
              Gerenciar SKUs
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewResponsesTab() {
  const [pendingReviews, setPendingReviews] = useState([]);
  const [currentReview, setCurrentReview] = useState(null);

  return (
    <div className="review-responses-tab">
      <h2>✏️ Revisar e Corrigir Respostas da IA</h2>

      <div className="review-stats">
        <div className="stat-card">
          <span className="number">{pendingReviews.length}</span>
          <span className="label">Respostas para Revisar</span>
        </div>
        <div className="stat-card">
          <span className="number">87%</span>
          <span className="label">Taxa de Aprovação</span>
        </div>
        <div className="stat-card">
          <span className="number">342</span>
          <span className="label">Correções este mês</span>
        </div>
      </div>

      <div className="review-interface">
        {currentReview && (
          <div className="review-card">
            <div className="context">
              <h3>Contexto do Produto</h3>
              <p><strong>Título:</strong> {currentReview.item_title}</p>
              <p><strong>SKU:</strong> {currentReview.item_sku}</p>
              <p><strong>Categoria:</strong> {currentReview.item_category}</p>
            </div>

            <div className="question">
              <h3>Pergunta do Cliente</h3>
              <p className="question-text">{currentReview.question_text}</p>
              <div className="question-meta">
                <span>Intent: {currentReview.detected_intent}</span>
                <span>Sentiment: {currentReview.detected_sentiment}</span>
              </div>
            </div>

            <div className="ai-response">
              <h3>Resposta da IA</h3>
              <p className="response-text">{currentReview.response_text}</p>
              <div className="confidence">
                Confiança: {(currentReview.response_confidence * 100).toFixed(0)}%
              </div>
            </div>

            <div className="review-actions">
              <button onClick={() => approveResponse(currentReview.id)} className="btn-success">
                ✅ Aprovar
              </button>

              <button onClick={() => setEditMode(true)} className="btn-warning">
                ✏️ Editar
              </button>

              <button onClick={() => rejectResponse(currentReview.id)} className="btn-danger">
                ❌ Rejeitar e Reescrever
              </button>
            </div>

            {editMode && (
              <div className="edit-section">
                <textarea
                  defaultValue={currentReview.response_text}
                  rows={5}
                />
                <div className="edit-reason">
                  <label>Por que está editando?</label>
                  <select>
                    <option>Tom inadequado</option>
                    <option>Informação incorreta</option>
                    <option>Muito longo/curto</option>
                    <option>Faltou informação importante</option>
                    <option>Erro de português</option>
                    <option>Não seguiu política</option>
                  </select>
                </div>
                <div className="edit-feedback">
                  <label>Feedback para a IA aprender:</label>
                  <textarea
                    placeholder="Ex: Sempre mencione o prazo de entrega quando perguntarem sobre disponibilidade"
                    rows={2}
                  />
                </div>
                <button onClick={saveEdit} className="btn-primary">
                  💾 Salvar Correção
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="review-queue">
        <h3>Fila de Revisão</h3>
        {pendingReviews.map(review => (
          <div key={review.id} className="queue-item" onClick={() => setCurrentReview(review)}>
            <span className="intent">{review.detected_intent}</span>
            <span className="question">{review.question_text.substring(0, 50)}...</span>
            <span className="confidence">{(review.response_confidence * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PerformanceTab() {
  const [metrics, setMetrics] = useState({});
  const [period, setPeriod] = useState('7days');

  return (
    <div className="performance-tab">
      <h2>📊 Performance da IA</h2>

      <div className="period-selector">
        <button onClick={() => setPeriod('today')}>Hoje</button>
        <button onClick={() => setPeriod('7days')}>7 dias</button>
        <button onClick={() => setPeriod('30days')}>30 dias</button>
        <button onClick={() => setPeriod('90days')}>90 dias</button>
      </div>

      <div className="performance-overview">
        <div className="metric-card">
          <h3>Taxa de Automação</h3>
          <div className="big-number">{metrics.automation_rate}%</div>
          <p>Perguntas respondidas automaticamente</p>
        </div>

        <div className="metric-card">
          <h3>Taxa de Sucesso</h3>
          <div className="big-number">{metrics.success_rate}%</div>
          <p>Respostas aprovadas sem edição</p>
        </div>

        <div className="metric-card">
          <h3>Conversão</h3>
          <div className="big-number">{metrics.conversion_rate}%</div>
          <p>Perguntas que viraram vendas</p>
        </div>

        <div className="metric-card">
          <h3>Tempo de Resposta</h3>
          <div className="big-number">{metrics.avg_response_time}s</div>
          <p>Média de tempo para responder</p>
        </div>
      </div>

      <div className="performance-by-category">
        <h3>Performance por Categoria</h3>
        <table>
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Total Perguntas</th>
              <th>IA Respondeu</th>
              <th>Taxa Sucesso</th>
              <th>Conversão</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {metrics.by_category?.map(cat => (
              <tr key={cat.category_id}>
                <td>{cat.category_name}</td>
                <td>{cat.total_questions}</td>
                <td>{cat.ai_answered} ({cat.ai_percentage}%)</td>
                <td>{cat.success_rate}%</td>
                <td>{cat.conversion_rate}%</td>
                <td>
                  <button onClick={() => improveCategory(cat.category_id)}>
                    📈 Melhorar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="learning-insights">
        <h3>🧠 Insights de Aprendizado</h3>
        <div className="insights-list">
          <div className="insight">
            <span className="icon">💡</span>
            <p>IA tem 95% de sucesso em perguntas sobre <strong>frete</strong></p>
          </div>
          <div className="insight">
            <span className="icon">⚠️</span>
            <p>IA tem dificuldade com perguntas sobre <strong>compatibilidade técnica</strong> (65% sucesso)</p>
          </div>
          <div className="insight">
            <span className="icon">📈</span>
            <p>Respostas com <strong>emojis</strong> têm 15% mais conversão</p>
          </div>
          <div className="insight">
            <span className="icon">🎯</span>
            <p>SKUs do grupo <strong>"Importados"</strong> precisam de mais treinamento</p>
          </div>
        </div>
      </div>

      <div className="improvement-suggestions">
        <h3>📝 Sugestões de Melhoria</h3>
        <ul>
          <li>Adicionar mais exemplos de respostas para categoria "Eletrônicos"</li>
          <li>Criar template específico para negociações de preço</li>
          <li>Treinar IA sobre novo grupo de SKUs adicionado semana passada</li>
          <li>Revisar respostas com confiança abaixo de 70%</li>
        </ul>
      </div>
    </div>
  );
}
```

---

## 🔄 SISTEMA DE APRENDIZADO CONTÍNUO

### 1. MOTOR DE APRENDIZADO

```javascript
// backend/services/ai/learningEngine.js
class AILearningEngine {
  constructor() {
    this.db = getDb();
    this.learningQueue = [];
  }

  async learnFromInteraction(interaction) {
    // Analisar o que deu certo ou errado
    const analysis = await this.analyzeInteraction(interaction);

    // Extrair padrões
    const patterns = await this.extractPatterns(interaction, analysis);

    // Atualizar base de conhecimento
    await this.updateKnowledge(patterns);

    // Ajustar templates se necessário
    await this.adjustTemplates(patterns);

    // Recalcular métricas
    await this.updateMetrics(interaction);
  }

  async analyzeInteraction(interaction) {
    // Verificar se gerou venda
    const resulted_in_sale = await this.checkIfResultedInSale(
      interaction.buyer_id,
      interaction.item_id,
      interaction.response_date
    );

    // Analisar qualidade da resposta
    const quality = {
      was_edited: interaction.was_edited,
      edit_reason: interaction.edit_reason,
      response_time: interaction.response_time_minutes,
      confidence: interaction.response_confidence,
      resulted_in_sale
    };

    // Calcular score de sucesso
    quality.success_score = this.calculateSuccessScore(quality);

    return quality;
  }

  async extractPatterns(interaction, analysis) {
    const patterns = {
      successful_phrases: [],
      problematic_phrases: [],
      optimal_length: null,
      effective_keywords: []
    };

    if (analysis.success_score > 0.8) {
      // Extrair o que funcionou
      patterns.successful_phrases = this.extractKeyPhrases(interaction.response_text);
      patterns.optimal_length = interaction.response_text.length;

      // Salvar como exemplo positivo
      await this.savePositiveExample(interaction);
    } else {
      // Extrair o que não funcionou
      patterns.problematic_phrases = this.extractKeyPhrases(interaction.response_text);

      // Aprender com a correção se houver
      if (interaction.edited_response) {
        const improvement = this.compareResponses(
          interaction.response_text,
          interaction.edited_response
        );
        patterns.improvements = improvement;
      }
    }

    return patterns;
  }

  async updateKnowledge(patterns) {
    if (patterns.successful_phrases?.length > 0) {
      // Adicionar frases de sucesso ao conhecimento
      for (const phrase of patterns.successful_phrases) {
        await this.db.prepare(`
          INSERT INTO ai_knowledge_base (
            store_id, knowledge_type, group_identifier,
            rule_name, rule_content, priority
          ) VALUES (?, 'learned', 'auto', ?, ?, 7)
        `).run(
          interaction.store_id,
          `Frase efetiva: ${phrase.context}`,
          `Use frases como: "${phrase.text}" quando apropriado`
        );
      }
    }

    if (patterns.improvements) {
      // Criar regra baseada na melhoria
      await this.createImprovementRule(patterns.improvements);
    }
  }

  async batchLearn() {
    // Executar aprendizado em batch diariamente
    console.log('🧠 Iniciando aprendizado em batch...');

    // 1. Analisar todas as interações do dia
    const interactions = await this.db.prepare(`
      SELECT * FROM qa_history
      WHERE created_at > datetime('now', '-1 day')
      AND should_train_on = 1
    `).all();

    console.log(`Analisando ${interactions.length} interações...`);

    // 2. Agrupar por padrões
    const patterns = await this.groupByPatterns(interactions);

    // 3. Identificar melhores práticas
    const bestPractices = await this.identifyBestPractices(patterns);

    // 4. Atualizar regras globais
    await this.updateGlobalRules(bestPractices);

    // 5. Gerar relatório
    const report = await this.generateLearningReport(patterns, bestPractices);

    console.log('✅ Aprendizado completo!', report);

    return report;
  }

  async identifyBestPractices(patterns) {
    const practices = {
      by_intent: {},
      by_category: {},
      by_sku_group: {},
      universal: []
    };

    // Analisar por intenção
    for (const [intent, interactions] of Object.entries(patterns.by_intent)) {
      const successful = interactions.filter(i => i.resulted_in_sale);
      if (successful.length > 5) {
        practices.by_intent[intent] = {
          success_rate: successful.length / interactions.length,
          common_elements: this.findCommonElements(successful),
          avg_response_length: this.avgLength(successful),
          top_phrases: this.topPhrases(successful)
        };
      }
    }

    // Identificar práticas universais
    const allSuccessful = patterns.all.filter(i => i.resulted_in_sale);
    practices.universal = {
      opening_phrases: this.extractOpeningPhrases(allSuccessful),
      closing_phrases: this.extractClosingPhrases(allSuccessful),
      call_to_actions: this.extractCTAs(allSuccessful),
      optimal_response_length: this.calculateOptimalLength(allSuccessful)
    };

    return practices;
  }
}

// Agendar aprendizado
const learningEngine = new AILearningEngine();

// Aprendizado em tempo real
eventEmitter.on('question_answered', async (interaction) => {
  await learningEngine.learnFromInteraction(interaction);
});

// Aprendizado em batch (diário)
cron.schedule('0 3 * * *', async () => {
  await learningEngine.batchLearn();
});
```

---

## 📊 MÉTRICAS E MONITORAMENTO

```javascript
// backend/services/ai/metricsTracker.js
class AIMetricsTracker {
  async trackResponse(questionId, response) {
    // Métricas em tempo real
    await this.db.prepare(`
      INSERT INTO ai_metrics_realtime (
        question_id,
        response_time_ms,
        confidence,
        method,
        timestamp
      ) VALUES (?, ?, ?, ?, ?)
    `).run(
      questionId,
      response.processingTime,
      response.confidence,
      response.method,
      new Date().toISOString()
    );

    // Emitir para dashboard
    io.emit('ai_metric', {
      type: 'response',
      confidence: response.confidence,
      time: response.processingTime
    });
  }

  async generateDailyReport() {
    const report = await this.db.prepare(`
      SELECT
        COUNT(*) as total_questions,
        COUNT(CASE WHEN response_method LIKE 'ai%' THEN 1 END) as ai_answered,
        AVG(response_confidence) as avg_confidence,
        AVG(response_time_minutes) as avg_response_time,
        COUNT(CASE WHEN resulted_in_sale = 1 THEN 1 END) * 100.0 / COUNT(*) as conversion_rate,
        COUNT(CASE WHEN was_edited = 1 THEN 1 END) as edited_count,
        GROUP_CONCAT(DISTINCT detected_intent) as intents_handled
      FROM qa_history
      WHERE date(created_at) = date('now')
    `).get();

    return report;
  }
}
```

---

## 🎯 RESUMO DA SOLUÇÃO

### CARACTERÍSTICAS PRINCIPAIS:

1. **Aprendizado Contínuo**
   - IA aprende com cada interação
   - Identifica padrões de sucesso
   - Evolui automaticamente

2. **Contexto Completo**
   - Lê TODOS os dados do anúncio
   - Conhece histórico de problemas do SKU
   - Analisa perguntas anteriores

3. **Treinamento Customizado**
   - Por categoria
   - Por grupo de SKU
   - Por faixa de preço
   - Por marca

4. **Painel de Controle Total**
   - Criar regras específicas
   - Revisar e corrigir respostas
   - Ver métricas detalhadas
   - Treinar com exemplos

5. **Inteligência Evolutiva**
   - Aprende com correções
   - Identifica melhores práticas
   - Sugere melhorias automaticamente

Este sistema transforma a resposta de perguntas em uma **vantagem competitiva real**, com IA que evolui e melhora continuamente!