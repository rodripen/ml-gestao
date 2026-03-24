# 🎯 PLANO DE IMPLEMENTAÇÃO - FOCO EM VENDAS

## VISÃO GERAL
Sistema focado em **aumentar vendas** através de automação inteligente, sem se preocupar com precificação ou billing por enquanto.

---

## 🚀 FASE 1: RESPOSTA AUTOMÁTICA COM CLAUDE + HUMANO
**Objetivo**: Responder 80% das perguntas automaticamente, escalar 20% complexas para humano

### 1.1 ESTRUTURA DO BANCO DE DADOS

```sql
-- Criar novas tabelas para histórico completo
CREATE TABLE IF NOT EXISTS questions_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id TEXT NOT NULL,
  ml_question_id TEXT UNIQUE,
  item_id TEXT NOT NULL,
  item_sku TEXT, -- SKU para análise
  question_text TEXT NOT NULL,
  question_date DATETIME,
  buyer_nickname TEXT,

  -- Resposta
  response_text TEXT,
  response_date DATETIME,
  response_type TEXT, -- 'automatic', 'manual', 'hybrid'
  response_by TEXT, -- 'claude', 'human', 'template'

  -- Métricas
  response_time_seconds INTEGER,
  claude_confidence REAL,
  resulted_in_sale BOOLEAN DEFAULT 0,

  -- Categorização
  category TEXT, -- 'price', 'shipping', 'availability', 'technical', 'warranty'
  sentiment TEXT, -- 'positive', 'neutral', 'negative'

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Templates de resposta que funcionam bem
CREATE TABLE IF NOT EXISTS response_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id TEXT,
  category TEXT NOT NULL,
  trigger_keywords TEXT, -- palavras que ativam o template
  template_text TEXT NOT NULL,
  success_rate REAL DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  resulted_in_sales INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Aprendizado contínuo
CREATE TABLE IF NOT EXISTS response_learning (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_pattern TEXT,
  successful_response TEXT,
  item_category TEXT,
  conversion_rate REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 1.2 IMPLEMENTAÇÃO DO AUTO-RESPONDER

```javascript
// backend/services/autoResponder.js
const { getDb } = require('../config/database');

class SmartAutoResponder {
  constructor() {
    this.db = getDb();
    this.loadTemplates();
  }

  async processQuestion(question, itemData, storeId) {
    // Salvar pergunta no histórico
    await this.saveQuestion(question, itemData, storeId);

    // 1. Verificar se já respondemos algo similar com sucesso
    const similarSuccess = await this.findSimilarSuccessful(question.text, itemData.category_id);
    if (similarSuccess) {
      return await this.adaptAndRespond(similarSuccess, itemData, question);
    }

    // 2. Tentar responder com template
    const templateResponse = await this.tryTemplate(question.text, itemData);
    if (templateResponse) {
      return await this.respondWithTemplate(templateResponse, question, itemData);
    }

    // 3. Usar Claude para perguntas complexas
    const claudeResponse = await this.askClaude(question, itemData, storeId);

    // 4. Se Claude não tem certeza, escalar para humano
    if (claudeResponse.confidence < 0.7) {
      return await this.escalateToHuman(question, claudeResponse.suggestedResponse);
    }

    return await this.respondWithClaude(claudeResponse, question);
  }

  async askClaude(question, itemData, storeId) {
    const prompt = `
    Você é um vendedor experiente do Mercado Livre respondendo perguntas sobre produtos.

    PRODUTO:
    - Título: ${itemData.title}
    - SKU: ${itemData.seller_custom_field}
    - Preço: R$ ${itemData.price}
    - Estoque: ${itemData.available_quantity} unidades
    - Vendidos: ${itemData.sold_quantity}
    - Descrição: ${itemData.description?.substring(0, 500)}

    HISTÓRICO DE PROBLEMAS COM ESTE SKU:
    ${await this.getSkuIssues(itemData.seller_custom_field)}

    PERGUNTA DO CLIENTE: "${question.text}"

    REGRAS IMPORTANTES:
    1. Se for negociação de preço, máximo 5% de desconto à vista
    2. Se perguntar sobre garantia, informar 90 dias pelo vendedor + garantia do fabricante
    3. Sempre ser cordial e profissional
    4. Se não tiver certeza, retorne {confidence: 0.5, suggestedResponse: "..."}
    5. NUNCA inventar informações sobre o produto

    Responda em JSON:
    {
      "response": "sua resposta aqui",
      "confidence": 0.0 a 1.0,
      "category": "price|shipping|availability|technical|warranty|other",
      "shouldEscalate": true/false
    }
    `;

    // Aqui usaria o Claude via MCP
    const claudeResult = await this.callClaude(prompt);
    return JSON.parse(claudeResult);
  }

  async getSkuIssues(sku) {
    if (!sku) return "Sem histórico";

    const issues = await this.db.prepare(`
      SELECT
        COUNT(CASE WHEN type = 'claim' THEN 1 END) as claims,
        COUNT(CASE WHEN type = 'return' THEN 1 END) as returns,
        GROUP_CONCAT(DISTINCT issue_reason) as reasons
      FROM post_sales_issues
      WHERE item_sku = ?
      AND created_at > date('now', '-60 days')
    `).get(sku);

    if (issues.claims > 2) {
      return `ATENÇÃO: Este produto tem ${issues.claims} reclamações recentes. Motivos: ${issues.reasons}`;
    }

    return "Produto sem problemas recentes";
  }

  async escalateToHuman(question, suggestedResponse) {
    // Criar notificação para dashboard
    await this.db.prepare(`
      INSERT INTO pending_responses (
        question_id, item_id, question_text,
        suggested_response, priority, status
      ) VALUES (?, ?, ?, ?, 'high', 'pending')
    `).run(
      question.id,
      question.item_id,
      question.text,
      suggestedResponse
    );

    // Enviar notificação (email, WhatsApp, etc)
    await this.sendUrgentNotification({
      type: 'question_needs_response',
      question: question.text,
      item: question.item_id,
      suggestion: suggestedResponse
    });

    return {
      handled: false,
      escalated: true,
      message: 'Pergunta complexa enviada para análise humana'
    };
  }

  async saveResponseMetrics(question, response, resulted_in_sale = false) {
    await this.db.prepare(`
      UPDATE questions_history
      SET resulted_in_sale = ?,
          response_time_seconds = ?
      WHERE ml_question_id = ?
    `).run(
      resulted_in_sale ? 1 : 0,
      Math.floor((Date.now() - question.date_created) / 1000),
      question.id
    );

    // Atualizar taxa de sucesso do template/método usado
    if (response.method === 'template') {
      await this.db.prepare(`
        UPDATE response_templates
        SET usage_count = usage_count + 1,
            resulted_in_sales = resulted_in_sales + ?
        WHERE id = ?
      `).run(resulted_in_sale ? 1 : 0, response.template_id);
    }
  }
}
```

---

## 🔄 FASE 2: REPUBLICAÇÃO INTELIGENTE

### 2.1 BANCO DE DADOS

```sql
CREATE TABLE IF NOT EXISTS republication_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  conditions JSON, -- {"days_without_sale": 60, "visits_threshold": 10}
  actions JSON, -- {"close_original": true, "improve_title": true}
  is_active BOOLEAN DEFAULT 1,
  last_run DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS republication_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id TEXT NOT NULL,
  original_item_id TEXT NOT NULL,
  new_item_id TEXT,
  original_title TEXT,
  new_title TEXT,
  improvements JSON, -- todas as melhorias aplicadas

  -- Métricas comparativas
  visits_before INTEGER,
  visits_after INTEGER,
  sales_before INTEGER,
  sales_after INTEGER,

  republication_date DATETIME,
  success BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS title_variations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id TEXT NOT NULL,
  base_item_id TEXT NOT NULL,
  variation_title TEXT NOT NULL,
  variation_item_id TEXT,
  performance_score REAL DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2 SISTEMA DE REPUBLICAÇÃO

```javascript
// backend/services/smartRepublisher.js
class SmartRepublisher {
  constructor() {
    this.db = getDb();
    this.mlApi = null;
  }

  async checkAndRepublish(storeId) {
    const rules = await this.getActiveRules(storeId);
    const items = await this.getStoreItems(storeId);

    for (const item of items) {
      for (const rule of rules) {
        if (await this.shouldRepublish(item, rule)) {
          await this.republish(item, rule, storeId);
        }
      }
    }
  }

  async shouldRepublish(item, rule) {
    const conditions = JSON.parse(rule.conditions);

    // Verificar dias sem venda
    if (conditions.days_without_sale) {
      const lastSale = await this.getLastSaleDate(item.id);
      const daysSinceLastSale = this.daysSince(lastSale);

      if (daysSinceLastSale > conditions.days_without_sale) {
        return true;
      }
    }

    // Verificar visitas baixas
    if (conditions.visits_threshold) {
      const recentVisits = await this.getRecentVisits(item.id, 7); // últimos 7 dias
      if (recentVisits < conditions.visits_threshold) {
        return true;
      }
    }

    // Verificar conversão baixa
    if (conditions.conversion_rate) {
      const conversion = item.sold_quantity / (item.visits || 1);
      if (conversion < conditions.conversion_rate) {
        return true;
      }
    }

    return false;
  }

  async republish(item, rule, storeId) {
    console.log(`📦 Republicando item ${item.id} - ${item.title}`);

    try {
      // 1. Melhorar título com Claude
      const improvedTitle = await this.improveTitle(item.title, item.category_id);

      // 2. Melhorar descrição
      const improvedDescription = await this.improveDescription(
        item.description,
        item.attributes,
        await this.getSkuIssues(item.seller_custom_field)
      );

      // 3. Verificar e otimizar fotos
      const photoSuggestions = await this.analyzePhotos(item.pictures);

      // 4. Fechar anúncio original
      await this.mlApi.changeItemStatus(item.id, 'closed');

      // 5. Criar novo anúncio otimizado
      const newItem = await this.mlApi.createItem({
        title: improvedTitle,
        category_id: item.category_id,
        price: item.price,
        currency_id: item.currency_id,
        available_quantity: item.available_quantity,
        buying_mode: item.buying_mode,
        condition: item.condition,
        listing_type_id: item.listing_type_id,
        description: { plain_text: improvedDescription },
        pictures: item.pictures,
        attributes: item.attributes,
        seller_custom_field: item.seller_custom_field // manter SKU
      });

      // 6. Registrar no histórico
      await this.saveRepublicationHistory(item, newItem, {
        improvedTitle,
        improvedDescription,
        photoSuggestions
      });

      console.log(`✅ Republicado com sucesso: ${newItem.permalink}`);
      return newItem;

    } catch (error) {
      console.error(`❌ Erro ao republicar ${item.id}:`, error);
      await this.logError(item.id, error);
      return null;
    }
  }

  async improveTitle(currentTitle, categoryId) {
    // Usar Claude para melhorar o título
    const prompt = `
    Melhore este título de produto do Mercado Livre:

    Título atual: "${currentTitle}"

    Regras:
    1. Máximo 60 caracteres
    2. Incluir palavras-chave importantes
    3. Mencionar marca se relevante
    4. Destacar principal benefício
    5. Sem caracteres especiais excessivos
    6. Ordem: [Produto] + [Marca] + [Modelo/Especificação] + [Diferencial]

    Retorne APENAS o novo título, sem aspas ou explicações.
    `;

    const improved = await this.callClaude(prompt);
    return improved.trim();
  }

  async improveDescription(currentDesc, attributes, skuIssues) {
    const prompt = `
    Crie uma descrição otimizada para Mercado Livre:

    Descrição atual: ${currentDesc?.substring(0, 1000)}

    ${skuIssues ? `IMPORTANTE - Histórico de problemas: ${skuIssues}` : ''}

    Estrutura ideal:

    ⭐ DESTAQUES PRINCIPAIS
    [3-4 bullet points com principais benefícios]

    📋 ESPECIFICAÇÕES TÉCNICAS
    ${attributes.map(a => `• ${a.name}: ${a.value_name}`).join('\n')}

    📦 CONTEÚDO DA EMBALAGEM
    [Listar o que vem na caixa]

    ✅ GARANTIA E SUPORTE
    • Garantia de 90 dias pelo vendedor
    • Suporte pós-venda via Mercado Livre
    • Nota fiscal enviada por email

    ${currentDesc ? `\n---\nDESCRIÇÃO ORIGINAL:\n${currentDesc}` : ''}

    Crie uma descrição profissional e vendedora.
    `;

    return await this.callClaude(prompt);
  }
}
```

---

## 🔀 FASE 3: MULTIPLICADOR DE ANÚNCIOS E VARIAÇÕES

### 3.1 GERADOR DE VARIAÇÕES

```javascript
// backend/services/listingMultiplier.js
class ListingMultiplier {
  constructor() {
    this.db = getDb();
  }

  async generateVariations(itemId, storeId, count = 10) {
    const item = await this.mlApi.getItem(itemId);

    // Gerar variações de título com Claude
    const titleVariations = await this.generateTitleVariations(item, count);

    // Criar anúncios com variações
    const results = [];
    for (const variation of titleVariations) {
      try {
        const newItem = await this.createVariation(item, variation, storeId);
        results.push(newItem);

        // Salvar no banco
        await this.saveVariation(item.id, newItem, storeId);

        // Delay para não sobrecarregar API
        await this.sleep(2000);
      } catch (error) {
        console.error(`Erro ao criar variação: ${error.message}`);
      }
    }

    return results;
  }

  async generateTitleVariations(item, count) {
    const prompt = `
    Crie ${count} variações do título abaixo para o Mercado Livre.
    Cada variação deve destacar um aspecto diferente do produto.

    Título original: "${item.title}"
    Categoria: ${item.category_id}

    Regras para cada variação:
    1. Máximo 60 caracteres
    2. Manter a essência do produto
    3. Variar ordem das palavras
    4. Destacar diferentes benefícios
    5. Usar sinônimos quando apropriado
    6. Algumas com PROMOÇÃO, QUEIMA, OFERTA (mas não todas)

    Retorne um JSON array com as variações:
    ["variação 1", "variação 2", ...]
    `;

    const response = await this.callClaude(prompt);
    return JSON.parse(response);
  }

  async balanceAcrossAccounts(itemId, stores) {
    // Distribuir anúncios entre múltiplas contas
    console.log(`⚖️ Balanceando anúncio entre ${stores.length} contas`);

    const originalItem = await this.mlApi.getItem(itemId);
    const results = [];

    for (const store of stores) {
      // Pular a loja original
      if (store.id === originalItem.seller_id) continue;

      try {
        // Criar cópia na outra conta
        const mlApi = await tokenManager.getApiClient(store.id);

        // Pequena variação no título para evitar duplicação exata
        const titleVariation = await this.generateSingleVariation(originalItem.title);

        const newItem = await mlApi.createItem({
          ...originalItem,
          title: titleVariation,
          seller_custom_field: originalItem.seller_custom_field // manter SKU
        });

        results.push({
          store_id: store.id,
          item_id: newItem.id,
          permalink: newItem.permalink
        });

        console.log(`✅ Criado na conta ${store.ml_nickname}: ${newItem.id}`);

      } catch (error) {
        console.error(`❌ Erro na conta ${store.id}:`, error.message);
      }
    }

    return results;
  }

  async trackVariationPerformance() {
    // Acompanhar qual variação performa melhor
    const variations = await this.db.prepare(`
      SELECT
        tv.*,
        ih.visits,
        ih.sold_quantity,
        ih.visits / NULLIF(ih.sold_quantity, 0) as conversion_rate
      FROM title_variations tv
      LEFT JOIN items_history ih ON tv.variation_item_id = ih.ml_item_id
      WHERE tv.is_active = 1
      AND ih.snapshot_date = date('now')
    `).all();

    // Identificar as melhores
    const topPerformers = variations
      .sort((a, b) => (b.conversion_rate || 0) - (a.conversion_rate || 0))
      .slice(0, 5);

    console.log('🏆 Top 5 variações:');
    topPerformers.forEach((v, i) => {
      console.log(`${i + 1}. "${v.variation_title}" - ${v.sold_quantity} vendas`);
    });

    return topPerformers;
  }
}
```

---

## 📊 FASE 4: GESTÃO DE PÓS-VENDA E RECLAMAÇÕES

### 4.1 BANCO DE DADOS COMPLETO

```sql
-- Tabela central de problemas pós-venda
CREATE TABLE IF NOT EXISTS post_sales_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id TEXT NOT NULL,
  ml_resource_id TEXT UNIQUE, -- ID da claim/return no ML
  type TEXT NOT NULL, -- 'claim', 'return', 'mediation', 'cancellation'
  status TEXT NOT NULL, -- 'open', 'in_progress', 'resolved', 'closed'

  -- Informações do pedido
  order_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_sku TEXT, -- SKU para análise
  item_title TEXT,

  -- Detalhes do problema
  issue_reason TEXT, -- motivo da reclamação
  issue_description TEXT, -- descrição detalhada
  buyer_message TEXT, -- mensagem do comprador

  -- Resolução
  resolution_type TEXT, -- 'refund', 'return', 'exchange', 'discount'
  resolution_amount REAL,
  resolution_date DATETIME,
  resolution_notes TEXT,

  -- Métricas
  response_time_hours INTEGER,
  cost_to_seller REAL, -- custo total para o vendedor

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Índices para análise por SKU
CREATE INDEX idx_sku_issues ON post_sales_issues(item_sku, type);
CREATE INDEX idx_item_issues ON post_sales_issues(item_id, type);

-- Mensagens de mediação
CREATE TABLE IF NOT EXISTS mediation_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL,
  sender TEXT NOT NULL, -- 'buyer', 'seller', 'mercadolibre'
  message TEXT NOT NULL,
  attachments JSON,
  sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (issue_id) REFERENCES post_sales_issues(id)
);

-- Análise de produtos problemáticos
CREATE VIEW problematic_products AS
SELECT
  item_sku,
  item_title,
  COUNT(*) as total_issues,
  COUNT(CASE WHEN type = 'claim' THEN 1 END) as claims,
  COUNT(CASE WHEN type = 'return' THEN 1 END) as returns,
  COUNT(CASE WHEN type = 'cancellation' THEN 1 END) as cancellations,
  AVG(cost_to_seller) as avg_cost,
  GROUP_CONCAT(DISTINCT issue_reason) as common_reasons
FROM post_sales_issues
WHERE created_at > date('now', '-90 days')
GROUP BY item_sku
HAVING total_issues > 2
ORDER BY total_issues DESC;
```

### 4.2 GESTOR DE RECLAMAÇÕES

```javascript
// backend/services/claimsManager.js
class ClaimsManager {
  constructor() {
    this.db = getDb();
  }

  async processNewClaim(claim, storeId) {
    // Salvar no banco
    await this.saveClaim(claim, storeId);

    // Analisar gravidade
    const severity = await this.analyzeSeverity(claim);

    // Se crítico, escalar imediatamente
    if (severity === 'critical') {
      await this.escalateUrgent(claim);
    }

    // Buscar histórico do SKU
    const skuHistory = await this.getSkuIssueHistory(claim.item_sku);

    // Preparar resposta com Claude
    const response = await this.prepareResponse(claim, skuHistory);

    return {
      claim_id: claim.id,
      severity,
      suggested_response: response,
      sku_history: skuHistory
    };
  }

  async prepareResponse(claim, skuHistory) {
    const prompt = `
    Ajude a responder esta reclamação no Mercado Livre:

    RECLAMAÇÃO:
    Tipo: ${claim.type}
    Motivo: ${claim.reason}
    Mensagem do comprador: "${claim.buyer_message}"

    HISTÓRICO DESTE SKU:
    - Total de reclamações anteriores: ${skuHistory.total_issues}
    - Motivos comuns: ${skuHistory.common_reasons}

    Crie uma resposta profissional que:
    1. Demonstre empatia
    2. Assuma responsabilidade quando apropriado
    3. Ofereça solução clara
    4. Seja breve e objetiva

    Se o produto tem muitos problemas, sugira:
    - Retirar de venda temporariamente
    - Revisar fornecedor
    - Melhorar descrição com avisos

    Resposta:
    `;

    return await this.callClaude(prompt);
  }

  async analyzeProductIssues(storeId, days = 90) {
    const analysis = await this.db.prepare(`
      SELECT
        item_sku,
        item_title,
        COUNT(*) as issue_count,
        SUM(cost_to_seller) as total_cost,
        GROUP_CONCAT(issue_reason) as reasons
      FROM post_sales_issues
      WHERE store_id = ?
      AND created_at > date('now', '-' || ? || ' days')
      GROUP BY item_sku
      HAVING issue_count > 1
      ORDER BY total_cost DESC
    `).all(storeId, days);

    return {
      problematic_skus: analysis,
      recommendations: await this.generateRecommendations(analysis)
    };
  }

  async generateRecommendations(analysis) {
    const recommendations = [];

    for (const product of analysis) {
      if (product.issue_count > 5) {
        recommendations.push({
          sku: product.item_sku,
          action: 'REMOVER',
          reason: `${product.issue_count} problemas, custo total: R$ ${product.total_cost}`,
          priority: 'HIGH'
        });
      } else if (product.issue_count > 3) {
        recommendations.push({
          sku: product.item_sku,
          action: 'REVISAR',
          reason: `Problemas recorrentes: ${product.reasons}`,
          priority: 'MEDIUM'
        });
      }
    }

    return recommendations;
  }
}
```

---

## 🎯 FASE 5: DASHBOARD DE CONTROLE

### 5.1 PÁGINA DE CONTROLE CENTRAL

```javascript
// frontend/pages/control-center.js
import { useState, useEffect } from 'react';

export default function ControlCenter() {
  const [stats, setStats] = useState({});
  const [pendingQuestions, setPendingQuestions] = useState([]);
  const [problematicProducts, setProblematicProducts] = useState([]);

  return (
    <div className="control-center">
      {/* Painel de Perguntas Pendentes */}
      <div className="questions-panel">
        <h2>🤖 Central de Respostas (IA + Humano)</h2>
        <div className="stats-row">
          <div className="stat-card">
            <span className="number">{stats.auto_answered || 0}</span>
            <span className="label">Respondidas por IA hoje</span>
          </div>
          <div className="stat-card">
            <span className="number">{stats.pending_human || 0}</span>
            <span className="label">Aguardando resposta humana</span>
          </div>
          <div className="stat-card">
            <span className="number">{stats.response_time || '2min'}</span>
            <span className="label">Tempo médio resposta</span>
          </div>
        </div>

        {/* Lista de perguntas para responder */}
        <div className="pending-questions">
          {pendingQuestions.map(q => (
            <QuestionCard
              key={q.id}
              question={q}
              onRespond={handleRespond}
              suggestedResponse={q.claude_suggestion}
            />
          ))}
        </div>
      </div>

      {/* Painel de Republicação */}
      <div className="republication-panel">
        <h2>🔄 Republicação Automática</h2>
        <div className="config-section">
          <h3>Regras Ativas</h3>
          <ul>
            <li>✅ Republicar após 60 dias sem venda</li>
            <li>✅ Republicar se menos de 10 visitas/semana</li>
            <li>✅ Melhorar título e descrição com IA</li>
          </ul>
          <button onClick={configureRules}>Configurar Regras</button>
        </div>

        <div className="recent-republications">
          <h3>Últimas Republicações</h3>
          {/* Lista de itens republicados */}
        </div>
      </div>

      {/* Painel de Produtos Problemáticos */}
      <div className="problematic-products">
        <h2>⚠️ Produtos com Problemas Pós-Venda</h2>
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Produto</th>
              <th>Reclamações</th>
              <th>Devoluções</th>
              <th>Custo Total</th>
              <th>Ação Recomendada</th>
            </tr>
          </thead>
          <tbody>
            {problematicProducts.map(product => (
              <tr key={product.sku} className={product.priority}>
                <td>{product.sku}</td>
                <td>{product.title}</td>
                <td>{product.claims}</td>
                <td>{product.returns}</td>
                <td>R$ {product.total_cost}</td>
                <td>
                  <button className={`action-${product.recommended_action}`}>
                    {product.recommended_action}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Painel de Multiplicação de Anúncios */}
      <div className="multiplication-panel">
        <h2>🔀 Multiplicador de Anúncios</h2>
        <div className="multiplication-form">
          <input
            type="text"
            placeholder="ID do anúncio base"
          />
          <input
            type="number"
            placeholder="Quantas variações?"
            min="1"
            max="30"
          />
          <button onClick={generateVariations}>
            Gerar Variações com IA
          </button>
        </div>

        <div className="balance-accounts">
          <h3>Balancear entre contas</h3>
          <button onClick={balanceAllAccounts}>
            Distribuir anúncios entre 4 contas
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 📅 CRONOGRAMA DE IMPLEMENTAÇÃO

### SEMANA 1: Base e Resposta Automática
**Segunda-Terça:**
- [ ] Criar todas as tabelas do banco de dados
- [ ] Implementar `autoResponder.js` com Claude
- [ ] Criar endpoints para salvar histórico de perguntas

**Quarta-Quinta:**
- [ ] Implementar dashboard de perguntas pendentes
- [ ] Sistema de templates de resposta
- [ ] Testes com perguntas reais

**Sexta:**
- [ ] Ajustes e melhorias baseados em testes
- [ ] Deploy da resposta automática

### SEMANA 2: Republicação e Multiplicação
**Segunda-Terça:**
- [ ] Implementar `smartRepublisher.js`
- [ ] Sistema de regras configuráveis
- [ ] Melhorias de título/descrição com Claude

**Quarta-Quinta:**
- [ ] Implementar `listingMultiplier.js`
- [ ] Gerador de variações de título
- [ ] Balanceamento entre contas

**Sexta:**
- [ ] Dashboard de controle
- [ ] Testes e ajustes

### SEMANA 3: Pós-Venda e Análise
**Segunda-Terça:**
- [ ] Implementar `claimsManager.js`
- [ ] Sistema de análise por SKU
- [ ] Identificação de produtos problemáticos

**Quarta-Quinta:**
- [ ] Dashboard de métricas pós-venda
- [ ] Relatórios de produtos problemáticos
- [ ] Sistema de recomendações

**Sexta:**
- [ ] Integração completa
- [ ] Testes finais
- [ ] Deploy

---

## 🎯 MÉTRICAS DE SUCESSO

### KPIs para Acompanhar:
1. **Taxa de Resposta Automática**: Meta 80%
2. **Tempo Médio de Resposta**: < 5 minutos
3. **Conversão Pós-Pergunta**: Aumentar 20%
4. **Vendas Pós-Republicação**: Aumentar 30%
5. **Redução de Reclamações**: -25% em produtos identificados
6. **Multiplicação Efetiva**: 10x mais anúncios ativos

### Relatórios Semanais:
- Perguntas respondidas (IA vs Humano)
- Items republicados e performance
- Produtos problemáticos identificados
- Variações criadas e performance
- Economia de tempo em horas

---

## 💡 DIFERENCIAIS DO SISTEMA

1. **Memória por SKU**: Sistema aprende problemas de cada produto
2. **Claude Contextualizado**: IA conhece histórico de problemas
3. **Republicação Inteligente**: Não apenas republica, melhora
4. **Multiplicação Estratégica**: Testa variações e identifica vencedoras
5. **Pós-Venda Proativo**: Identifica produtos problema ANTES de virar crise

---

## 🚀 COMANDO PARA COMEÇAR

```bash
# 1. Criar banco de dados com novas tabelas
cd backend
npm run migrate

# 2. Implementar primeira feature (auto-responder)
npm run dev

# 3. Testar com perguntas reais
npm run test:questions
```

Este plano foca 100% em **aumentar vendas** e **melhorar operação**, sem se preocupar com cobrança ou precificação!