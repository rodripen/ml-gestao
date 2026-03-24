# 🚀 PRÓXIMOS PASSOS - IMPLEMENTAÇÃO DETALHADA

## 1. IMPLEMENTAR MAIS ENDPOINTS NO BACKEND

### 1.1 Reviews e Avaliações

#### O que faria:
- Permitir visualizar avaliações dos produtos
- Responder reviews de clientes
- Analisar sentimento das avaliações
- Identificar produtos com baixa avaliação

#### Como implementar:

**Novo arquivo: `backend/routes/reviews.js`**
```javascript
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const tokenManager = require('../services/tokenManager');

// GET /api/reviews/item/:itemId - Buscar reviews de um item
router.get('/item/:itemId', requireAuth, async (req, res) => {
  const mlApi = await tokenManager.getApiClient(req.session.storeId);

  // Buscar reviews do item
  const reviews = await mlApi.client.get(`/reviews/item/${req.params.itemId}`, {
    params: { limit: 100 }
  });

  // Análise de sentimento
  const sentiment = {
    positive: reviews.data.reviews.filter(r => r.rate >= 4).length,
    neutral: reviews.data.reviews.filter(r => r.rate === 3).length,
    negative: reviews.data.reviews.filter(r => r.rate <= 2).length,
    average: reviews.data.rating_average
  };

  res.json({
    reviews: reviews.data.reviews,
    sentiment,
    total: reviews.data.paging.total
  });
});

// POST /api/reviews/:reviewId/reply - Responder review
router.post('/:reviewId/reply', requireAuth, async (req, res) => {
  const mlApi = await tokenManager.getApiClient(req.session.storeId);
  const { message } = req.body;

  await mlApi.client.post(`/reviews/${req.params.reviewId}/reply`, {
    message
  });

  res.json({ success: true });
});
```

**Adicionar em `backend/services/mercadolivre.js`:**
```javascript
async getItemReviews(itemId, limit = 100) {
  const { data } = await this.client.get(`/reviews/item/${itemId}`, {
    params: { limit }
  });
  return data;
}

async replyToReview(reviewId, message) {
  const { data } = await this.client.post(`/reviews/${reviewId}/reply`, {
    message
  });
  return data;
}
```

### 1.2 Tendências e Insights

#### O que faria:
- Mostrar produtos mais vendidos da categoria
- Identificar tendências de busca
- Comparar preços com concorrentes
- Prever demanda futura

#### Como implementar:

**Novo arquivo: `backend/routes/trends.js`**
```javascript
// GET /api/trends/category/:categoryId
router.get('/category/:categoryId', requireAuth, async (req, res) => {
  const mlApi = await tokenManager.getApiClient(req.session.storeId);

  // Buscar tendências da categoria
  const trends = await mlApi.client.get(`/trends/MLB/${req.params.categoryId}`);

  // Buscar top produtos
  const topProducts = await mlApi.client.get(`/highlights/top/MLB`, {
    params: { category: req.params.categoryId }
  });

  // Análise de preços da concorrência
  const categoryItems = await mlApi.client.get(`/sites/MLB/search`, {
    params: {
      category: req.params.categoryId,
      sort: 'sold_quantity_desc',
      limit: 20
    }
  });

  const priceAnalysis = {
    min: Math.min(...categoryItems.data.results.map(i => i.price)),
    max: Math.max(...categoryItems.data.results.map(i => i.price)),
    avg: categoryItems.data.results.reduce((sum, i) => sum + i.price, 0) / categoryItems.data.results.length,
    median: categoryItems.data.results.sort((a, b) => a.price - b.price)[10]?.price
  };

  res.json({
    trends: trends.data,
    topProducts: topProducts.data,
    priceAnalysis,
    competitors: categoryItems.data.results
  });
});

// GET /api/trends/search-terms - Termos mais buscados
router.get('/search-terms', requireAuth, async (req, res) => {
  const mlApi = await tokenManager.getApiClient(req.session.storeId);

  const searchTrends = await mlApi.client.get('/trends/MLB/search');

  res.json({
    trending: searchTrends.data.trending_searches,
    seasonal: searchTrends.data.seasonal_trends
  });
});
```

### 1.3 Reclamações e Mediações

#### O que faria:
- Listar reclamações abertas
- Responder mediações
- Tracking de devoluções
- Alertas de prazos

#### Como implementar:

**Novo arquivo: `backend/routes/claims.js`**
```javascript
// GET /api/claims - Listar reclamações
router.get('/', requireAuth, async (req, res) => {
  const mlApi = await tokenManager.getApiClient(req.session.storeId);
  const store = await getStore(req.session.storeId);

  const claims = await mlApi.client.get('/post-purchase/v1/claims/search', {
    params: {
      'players.user_id': store.ml_user_id,
      'players.role': 'respondent',
      status: 'opened'
    }
  });

  // Adicionar alertas de prazo
  const claimsWithAlerts = claims.data.results.map(claim => ({
    ...claim,
    urgency: calculateUrgency(claim.created_date),
    deadline: addDays(claim.created_date, 3)
  }));

  res.json(claimsWithAlerts);
});

// POST /api/claims/:claimId/message - Responder reclamação
router.post('/:claimId/message', requireAuth, async (req, res) => {
  const mlApi = await tokenManager.getApiClient(req.session.storeId);
  const { message, attachments } = req.body;

  await mlApi.client.post(`/post-purchase/v1/claims/${req.params.claimId}/messages`, {
    message,
    attachments
  });

  res.json({ success: true });
});

// POST /api/claims/:claimId/resolution - Propor solução
router.post('/:claimId/resolution', requireAuth, async (req, res) => {
  const mlApi = await tokenManager.getApiClient(req.session.storeId);
  const { type, amount } = req.body; // type: refund, partial_refund, return

  await mlApi.client.post(`/post-purchase/v1/claims/${req.params.claimId}/resolution`, {
    type,
    amount
  });

  res.json({ success: true });
});
```

### 1.4 Promoções e Campanhas

#### O que faria:
- Criar campanhas de desconto
- Participar de eventos do ML
- Gerenciar cupons
- Análise de ROI de promoções

#### Como implementar:

**Novo arquivo: `backend/routes/promotions.js`**
```javascript
// GET /api/promotions - Listar promoções disponíveis
router.get('/', requireAuth, async (req, res) => {
  const mlApi = await tokenManager.getApiClient(req.session.storeId);

  // Buscar campanhas do ML
  const mlCampaigns = await mlApi.client.get('/seller-promotions/promotions', {
    params: { promotion_type: 'MARKETPLACE_CAMPAIGN' }
  });

  // Buscar promoções próprias
  const sellerPromotions = await mlApi.client.get('/seller-promotions/promotions', {
    params: { promotion_type: 'SELLER_CAMPAIGN' }
  });

  res.json({
    marketplace: mlCampaigns.data,
    seller: sellerPromotions.data
  });
});

// GET /api/promotions/candidates - Items candidatos
router.get('/candidates', requireAuth, async (req, res) => {
  const mlApi = await tokenManager.getApiClient(req.session.storeId);

  const candidates = await mlApi.client.get('/seller-promotions/candidates');

  // Calcular potencial de ROI
  const candidatesWithROI = candidates.data.results.map(item => {
    const discountAmount = item.price * 0.2; // 20% desconto
    const expectedIncrease = 1.5; // 50% aumento em vendas
    const roi = (item.price - discountAmount) * expectedIncrease - item.price;

    return {
      ...item,
      suggestedDiscount: 20,
      expectedROI: roi,
      expectedSalesIncrease: 50
    };
  });

  res.json(candidatesWithROI);
});

// POST /api/promotions/create - Criar promoção
router.post('/create', requireAuth, async (req, res) => {
  const mlApi = await tokenManager.getApiClient(req.session.storeId);
  const { name, discount, items, startDate, endDate } = req.body;

  const promotion = await mlApi.client.post('/seller-promotions/promotions', {
    name,
    type: 'SELLER_CAMPAIGN',
    discount_percentage: discount,
    start_date: startDate,
    end_date: endDate
  });

  // Adicionar items à promoção
  for (const itemId of items) {
    await mlApi.client.post(`/seller-promotions/promotions/${promotion.data.id}/items`, {
      item_id: itemId
    });
  }

  res.json(promotion.data);
});
```

---

## 2. MELHORAR O DASHBOARD

### 2.1 Gráficos de Tendências

#### O que faria:
- Gráfico de vendas dos últimos 30/60/90 dias
- Comparação mês a mês
- Previsão de vendas futuras
- Heatmap de horários de maior venda

#### Como implementar:

**Novo componente: `frontend/components/TrendsChart.js`**
```jsx
import { LineChart, Line, AreaChart, Area, HeatMapGrid } from 'recharts';
import { useState, useEffect } from 'react';

export default function TrendsChart() {
  const [data, setData] = useState([]);
  const [period, setPeriod] = useState(30);
  const [forecast, setForecast] = useState([]);

  useEffect(() => {
    fetchTrendsData();
    fetchForecast();
  }, [period]);

  const fetchTrendsData = async () => {
    const res = await fetch(`/api/metrics/trends?days=${period}`);
    const trendsData = await res.json();

    // Processar dados para o gráfico
    const chartData = trendsData.map(day => ({
      date: formatDate(day.date),
      vendas: day.orders,
      faturamento: day.revenue,
      visitas: day.visits,
      conversao: (day.orders / day.visits * 100).toFixed(2)
    }));

    setData(chartData);
  };

  const fetchForecast = async () => {
    const res = await fetch('/api/metrics/forecast');
    const forecastData = await res.json();
    setForecast(forecastData);
  };

  return (
    <div className="trends-dashboard">
      {/* Seletor de período */}
      <div className="period-selector">
        <button onClick={() => setPeriod(7)}>7 dias</button>
        <button onClick={() => setPeriod(30)}>30 dias</button>
        <button onClick={() => setPeriod(90)}>90 dias</button>
      </div>

      {/* Gráfico de vendas e faturamento */}
      <div className="chart-container">
        <h3>Tendência de Vendas</h3>
        <LineChart width={800} height={300} data={data}>
          <Line type="monotone" dataKey="vendas" stroke="#8884d8" />
          <Line type="monotone" dataKey="faturamento" stroke="#82ca9d" />
          <Tooltip />
          <Legend />
        </LineChart>
      </div>

      {/* Previsão */}
      <div className="forecast-container">
        <h3>Previsão próximos 30 dias</h3>
        <AreaChart width={800} height={300} data={forecast}>
          <Area type="monotone" dataKey="expected" fill="#8884d8" />
          <Area type="monotone" dataKey="optimistic" fill="#82ca9d" />
          <Area type="monotone" dataKey="pessimistic" fill="#ff7300" />
        </AreaChart>
      </div>

      {/* Heatmap de horários */}
      <div className="heatmap-container">
        <h3>Melhores horários para venda</h3>
        <HeatMapGrid
          data={generateHeatmapData()}
          xLabels={hours}
          yLabels={weekDays}
        />
      </div>
    </div>
  );
}
```

### 2.2 Comparativo com Concorrência

#### O que faria:
- Comparar preços com concorrentes diretos
- Análise de posicionamento
- Share de mercado estimado
- Alertas de oportunidades

#### Como implementar:

**Novo componente: `frontend/components/CompetitorAnalysis.js`**
```jsx
export default function CompetitorAnalysis({ itemId }) {
  const [competitors, setCompetitors] = useState([]);
  const [myItem, setMyItem] = useState(null);
  const [analysis, setAnalysis] = useState({});

  useEffect(() => {
    analyzeCompetition();
  }, [itemId]);

  const analyzeCompetition = async () => {
    // Buscar meu item
    const myItemRes = await fetch(`/api/items/${itemId}`);
    const myItemData = await myItemRes.json();
    setMyItem(myItemData);

    // Buscar concorrentes
    const competitorsRes = await fetch(`/api/competitors/analyze`, {
      method: 'POST',
      body: JSON.stringify({
        title: myItemData.title,
        category: myItemData.category_id,
        price: myItemData.price
      })
    });
    const competitorsData = await competitorsRes.json();
    setCompetitors(competitorsData.competitors);

    // Análise comparativa
    const analysis = {
      pricePosition: calculatePricePosition(myItemData.price, competitorsData.competitors),
      marketShare: estimateMarketShare(myItemData.sold_quantity, competitorsData.totalSold),
      opportunities: identifyOpportunities(myItemData, competitorsData.competitors),
      threats: identifyThreats(myItemData, competitorsData.competitors)
    };

    setAnalysis(analysis);
  };

  return (
    <div className="competitor-analysis">
      {/* Gráfico de posicionamento de preço */}
      <div className="price-positioning">
        <h3>Posicionamento de Preço</h3>
        <ScatterChart width={600} height={300}>
          <Scatter name="Meu produto" data={[myItem]} fill="#8884d8" />
          <Scatter name="Concorrentes" data={competitors} fill="#82ca9d" />
          <XAxis dataKey="price" name="Preço" />
          <YAxis dataKey="sold_quantity" name="Vendas" />
          <Tooltip />
        </ScatterChart>
        <div className="price-suggestion">
          {analysis.pricePosition === 'high' && (
            <Alert type="warning">
              Seu preço está {analysis.percentageAboveAvg}% acima da média.
              Preço sugerido: R$ {analysis.suggestedPrice}
            </Alert>
          )}
        </div>
      </div>

      {/* Tabela comparativa */}
      <div className="comparison-table">
        <h3>Análise Detalhada</h3>
        <table>
          <thead>
            <tr>
              <th>Vendedor</th>
              <th>Preço</th>
              <th>Vendas</th>
              <th>Avaliação</th>
              <th>Frete Grátis</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            <tr className="my-item">
              <td>Você</td>
              <td>R$ {myItem?.price}</td>
              <td>{myItem?.sold_quantity}</td>
              <td>{myItem?.rating || 'N/A'}</td>
              <td>{myItem?.free_shipping ? 'Sim' : 'Não'}</td>
              <td>-</td>
            </tr>
            {competitors.map(comp => (
              <tr key={comp.id}>
                <td>{comp.seller.nickname}</td>
                <td>R$ {comp.price}</td>
                <td>{comp.sold_quantity}</td>
                <td>{comp.rating || 'N/A'}</td>
                <td>{comp.free_shipping ? 'Sim' : 'Não'}</td>
                <td>
                  <button onClick={() => matchPrice(comp.price)}>
                    Igualar preço
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Oportunidades e Ameaças */}
      <div className="swot-analysis">
        <div className="opportunities">
          <h4>📈 Oportunidades</h4>
          <ul>
            {analysis.opportunities?.map(opp => (
              <li key={opp.id}>
                {opp.description}
                <button onClick={() => applyOpportunity(opp)}>Aplicar</button>
              </li>
            ))}
          </ul>
        </div>
        <div className="threats">
          <h4>⚠️ Ameaças</h4>
          <ul>
            {analysis.threats?.map(threat => (
              <li key={threat.id}>{threat.description}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
```

### 2.3 Alertas de Oportunidades

#### O que faria:
- Notificar quando concorrente aumenta preço
- Alertar sobre produtos em alta demanda
- Avisar sobre campanhas do ML
- Sugerir republicações

#### Como implementar:

**Novo componente: `frontend/components/OpportunityAlerts.js`**
```jsx
export default function OpportunityAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [filters, setFilters] = useState({
    priceChanges: true,
    highDemand: true,
    campaigns: true,
    republish: true
  });

  useEffect(() => {
    checkOpportunities();
    const interval = setInterval(checkOpportunities, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [filters]);

  const checkOpportunities = async () => {
    const res = await fetch('/api/opportunities/check', {
      method: 'POST',
      body: JSON.stringify(filters)
    });
    const opportunities = await res.json();

    // Adicionar novas oportunidades com notificação
    const newAlerts = opportunities.filter(opp =>
      !alerts.find(a => a.id === opp.id)
    );

    if (newAlerts.length > 0) {
      showNotification(`${newAlerts.length} nova(s) oportunidade(s)!`);
      setAlerts([...newAlerts, ...alerts]);
    }
  };

  const takeAction = async (alert) => {
    switch(alert.type) {
      case 'price_increase':
        await fetch(`/api/items/${alert.itemId}/price`, {
          method: 'PUT',
          body: JSON.stringify({ price: alert.suggestedPrice })
        });
        break;
      case 'high_demand':
        await fetch(`/api/items/${alert.itemId}/stock`, {
          method: 'PUT',
          body: JSON.stringify({ quantity: alert.suggestedStock })
        });
        break;
      case 'campaign':
        await fetch(`/api/promotions/${alert.campaignId}/join`, {
          method: 'POST',
          body: JSON.stringify({ itemIds: alert.eligibleItems })
        });
        break;
      case 'republish':
        await fetch(`/api/items/${alert.itemId}/republish`, {
          method: 'POST'
        });
        break;
    }

    // Remover alerta após ação
    setAlerts(alerts.filter(a => a.id !== alert.id));
  };

  return (
    <div className="opportunity-alerts">
      <div className="alert-filters">
        <label>
          <input
            type="checkbox"
            checked={filters.priceChanges}
            onChange={(e) => setFilters({...filters, priceChanges: e.target.checked})}
          />
          Mudanças de preço dos concorrentes
        </label>
        {/* Outros filtros... */}
      </div>

      <div className="alerts-list">
        {alerts.map(alert => (
          <div key={alert.id} className={`alert alert-${alert.priority}`}>
            <div className="alert-icon">{getAlertIcon(alert.type)}</div>
            <div className="alert-content">
              <h4>{alert.title}</h4>
              <p>{alert.description}</p>
              <div className="alert-metrics">
                <span>Impacto estimado: {alert.estimatedImpact}</span>
                <span>Urgência: {alert.urgency}</span>
              </div>
            </div>
            <div className="alert-actions">
              <button onClick={() => takeAction(alert)} className="btn-primary">
                {alert.actionText}
              </button>
              <button onClick={() => dismissAlert(alert.id)} className="btn-secondary">
                Ignorar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 2.4 Análise Preditiva

#### O que faria:
- Prever vendas futuras com IA
- Identificar padrões sazonais
- Sugerir ajustes de estoque
- Prever necessidade de reposição

#### Como implementar:

**Backend - Novo endpoint: `backend/routes/predictions.js`**
```javascript
const tf = require('@tensorflow/tfjs-node'); // TensorFlow para predições

router.get('/sales-forecast/:itemId', requireAuth, async (req, res) => {
  const { itemId } = req.params;
  const { days = 30 } = req.query;

  // Buscar histórico de vendas
  const history = await db.prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as sales
    FROM orders_history
    WHERE item_id = ? AND created_at > date('now', '-90 days')
    GROUP BY DATE(created_at)
  `).all(itemId);

  // Preparar dados para o modelo
  const salesData = history.map(h => h.sales);
  const dates = history.map(h => new Date(h.date).getTime());

  // Criar modelo simples de regressão linear
  const model = tf.sequential({
    layers: [
      tf.layers.dense({inputShape: [1], units: 50}),
      tf.layers.dense({units: 50}),
      tf.layers.dense({units: 1})
    ]
  });

  model.compile({
    loss: 'meanSquaredError',
    optimizer: 'adam'
  });

  // Treinar modelo
  const xs = tf.tensor2d(dates, [dates.length, 1]);
  const ys = tf.tensor2d(salesData, [salesData.length, 1]);

  await model.fit(xs, ys, {epochs: 100});

  // Fazer previsões
  const futureDate = Array.from({length: days}, (_, i) =>
    new Date(Date.now() + (i + 1) * 86400000).getTime()
  );

  const predictions = model.predict(tf.tensor2d(futureDate, [days, 1]));
  const forecastArray = await predictions.array();

  // Calcular intervalos de confiança
  const forecast = forecastArray.map((pred, i) => {
    const value = Math.max(0, Math.round(pred[0]));
    const confidence = 0.95 - (i * 0.01); // Confiança diminui com o tempo
    const margin = value * (1 - confidence);

    return {
      date: new Date(futureDate[i]).toISOString().split('T')[0],
      expected: value,
      optimistic: Math.round(value + margin),
      pessimistic: Math.max(0, Math.round(value - margin)),
      confidence: confidence * 100
    };
  });

  // Identificar padrões
  const patterns = identifyPatterns(history);

  // Sugestões de ação
  const suggestions = generateSuggestions(forecast, patterns);

  res.json({
    forecast,
    patterns,
    suggestions,
    accuracy: calculateModelAccuracy(model, history)
  });
});

function identifyPatterns(history) {
  const patterns = [];

  // Detectar sazonalidade semanal
  const weekdayAvg = {};
  history.forEach(h => {
    const weekday = new Date(h.date).getDay();
    if (!weekdayAvg[weekday]) weekdayAvg[weekday] = [];
    weekdayAvg[weekday].push(h.sales);
  });

  const bestDay = Object.entries(weekdayAvg)
    .map(([day, sales]) => ({
      day: parseInt(day),
      avg: sales.reduce((a, b) => a + b, 0) / sales.length
    }))
    .sort((a, b) => b.avg - a.avg)[0];

  patterns.push({
    type: 'weekly_seasonality',
    description: `Melhor dia da semana: ${getDayName(bestDay.day)}`,
    impact: 'high'
  });

  // Detectar tendência
  const trend = calculateTrend(history.map(h => h.sales));
  patterns.push({
    type: 'trend',
    description: trend > 0 ? 'Vendas em crescimento' : 'Vendas em queda',
    value: trend,
    impact: Math.abs(trend) > 0.1 ? 'high' : 'medium'
  });

  return patterns;
}

function generateSuggestions(forecast, patterns) {
  const suggestions = [];

  // Sugestão de estoque
  const totalExpected = forecast.reduce((sum, f) => sum + f.expected, 0);
  suggestions.push({
    type: 'stock',
    action: 'Ajustar estoque',
    description: `Manter pelo menos ${Math.round(totalExpected * 1.2)} unidades para os próximos 30 dias`,
    priority: 'high'
  });

  // Sugestão baseada em padrões
  if (patterns.find(p => p.type === 'weekly_seasonality')) {
    suggestions.push({
      type: 'promotion',
      action: 'Criar promoção',
      description: 'Aproveitar dias de maior venda com promoções especiais',
      priority: 'medium'
    });
  }

  return suggestions;
}
```

---

## 3. AUTOMATIZAÇÕES VIA MCP

### 3.1 Resposta Automática a Perguntas

#### O que faria:
- Responder perguntas frequentes automaticamente
- Usar IA para entender contexto
- Escalar para humano quando necessário
- Aprender com respostas anteriores

#### Como implementar:

**Novo arquivo: `backend/mcp/automations/autoResponder.js`**
```javascript
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class AutoResponder {
  constructor() {
    this.faqDatabase = this.loadFAQ();
    this.responseTemplates = this.loadTemplates();
  }

  async processQuestion(question, itemData) {
    // 1. Verificar se é FAQ
    const faqMatch = this.matchFAQ(question.text);
    if (faqMatch) {
      return this.formatResponse(faqMatch, itemData);
    }

    // 2. Usar IA para entender intenção
    const intent = await this.analyzeIntent(question.text);

    // 3. Gerar resposta baseada na intenção
    switch(intent.type) {
      case 'price_negotiation':
        return this.handlePriceNegotiation(question, itemData);

      case 'availability':
        return this.handleAvailability(question, itemData);

      case 'shipping':
        return this.handleShipping(question, itemData);

      case 'technical':
        return this.handleTechnical(question, itemData);

      case 'complex':
        // Escalar para humano
        return {
          autoResponse: false,
          reason: 'Pergunta complexa requer atenção humana',
          suggestedResponse: await this.generateSuggestion(question, itemData)
        };

      default:
        return this.generateGenericResponse(question, itemData);
    }
  }

  async analyzeIntent(text) {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `Analise a pergunta do cliente e identifique a intenção.
                   Categorias: price_negotiation, availability, shipping, technical, warranty, complex.
                   Retorne JSON: { type: "categoria", confidence: 0-1, keywords: [] }`
        },
        { role: "user", content: text }
      ]
    });

    return JSON.parse(response.choices[0].message.content);
  }

  async handlePriceNegotiation(question, itemData) {
    // Verificar se mencionou um valor
    const priceMatch = question.text.match(/R?\$?\s?(\d+(?:[.,]\d{2})?)/);

    if (priceMatch) {
      const offeredPrice = parseFloat(priceMatch[1].replace(',', '.'));
      const minAcceptable = itemData.price * 0.9; // 10% desconto máximo

      if (offeredPrice >= minAcceptable) {
        return {
          autoResponse: true,
          text: `Olá! Posso fazer ${itemData.price * 0.95} à vista no PIX. É nosso melhor preço!`,
          createPromotion: true,
          promotionPrice: itemData.price * 0.95
        };
      } else {
        return {
          autoResponse: true,
          text: `Olá! Infelizmente não consigo chegar nesse valor. Nosso melhor preço é ${minAcceptable} à vista.`
        };
      }
    }

    return {
      autoResponse: true,
      text: `Olá! Para pagamento à vista no PIX, consigo fazer um desconto especial. Qual seria sua proposta?`
    };
  }

  async handleAvailability(question, itemData) {
    if (itemData.available_quantity > 0) {
      return {
        autoResponse: true,
        text: `Olá! Sim, temos ${itemData.available_quantity} unidades disponíveis para envio imediato!`
      };
    } else {
      // Verificar previsão de reposição
      const restockDate = await this.checkRestockDate(itemData.id);

      if (restockDate) {
        return {
          autoResponse: true,
          text: `Olá! No momento estamos sem estoque, mas teremos reposição em ${restockDate}. Posso reservar para você?`
        };
      } else {
        return {
          autoResponse: true,
          text: `Olá! Infelizmente este produto está esgotado no momento. Temos outros modelos similares, posso ajudar?`
        };
      }
    }
  }

  async handleShipping(question, itemData) {
    // Extrair CEP se mencionado
    const cepMatch = question.text.match(/\d{5}-?\d{3}/);

    if (cepMatch) {
      const shippingInfo = await this.calculateShipping(itemData.id, cepMatch[0]);
      return {
        autoResponse: true,
        text: `Olá! Para o CEP ${cepMatch[0]}:\n` +
              `- Prazo: ${shippingInfo.days} dias úteis\n` +
              `- Valor do frete: ${shippingInfo.cost > 0 ? `R$ ${shippingInfo.cost}` : 'GRÁTIS'}\n` +
              `- Transportadora: ${shippingInfo.carrier}`
      };
    }

    return {
      autoResponse: true,
      text: `Olá! Me informe seu CEP para calcular o frete e prazo de entrega.`
    };
  }

  // Sistema de aprendizado
  async learnFromResponse(question, response, feedback) {
    const db = getDb();

    db.prepare(`
      INSERT INTO auto_response_learning (
        question_text, intent, response_text,
        was_successful, feedback, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      question.text,
      question.intent,
      response.text,
      feedback.successful,
      feedback.comment,
      new Date().toISOString()
    );

    // Atualizar templates se resposta foi bem sucedida
    if (feedback.successful) {
      this.updateTemplates(question.intent, response.text);
    }
  }
}

// Integração com webhook de perguntas
async function handleQuestionWebhook(data) {
  const autoResponder = new AutoResponder();
  const itemData = await mlApi.getItem(data.item_id);

  const response = await autoResponder.processQuestion(data.question, itemData);

  if (response.autoResponse) {
    // Responder automaticamente
    await mlApi.answerQuestion(data.question.id, response.text);

    // Registrar para aprendizado
    await db.prepare(`
      INSERT INTO automated_responses
      (question_id, response_text, timestamp)
      VALUES (?, ?, ?)
    `).run(data.question.id, response.text, new Date().toISOString());

    // Se deve criar promoção
    if (response.createPromotion) {
      await mlApi.createTemporaryPromotion(
        data.from.id,
        itemData.id,
        response.promotionPrice
      );
    }
  } else {
    // Notificar vendedor para responder manualmente
    await notifySeller({
      type: 'manual_response_needed',
      question: data.question,
      suggestedResponse: response.suggestedResponse,
      reason: response.reason
    });
  }
}
```

### 3.2 Ajuste Dinâmico de Preços

#### O que faria:
- Monitorar preços da concorrência
- Ajustar automaticamente dentro de limites
- Otimizar para maximizar lucro
- Reagir a mudanças do mercado

#### Como implementar:

**Novo arquivo: `backend/mcp/automations/pricingEngine.js`**
```javascript
class DynamicPricingEngine {
  constructor() {
    this.rules = this.loadPricingRules();
    this.limits = this.loadPriceLimits();
  }

  async optimizePrice(itemId) {
    const item = await mlApi.getItem(itemId);
    const competitors = await this.getCompetitorPrices(item);
    const demand = await this.analyzeDemand(item);
    const costs = await this.getCosts(item);

    // Estratégias de precificação
    const strategies = {
      competitive: this.competitivePricing(item, competitors),
      demand: this.demandBasedPricing(item, demand),
      profit: this.profitMaximization(item, costs, demand),
      psychological: this.psychologicalPricing(item.price),
      dynamic: this.timeDynamicPricing(item)
    };

    // Selecionar melhor estratégia
    const optimalPrice = this.selectOptimalStrategy(strategies, item);

    // Validar dentro dos limites
    const finalPrice = this.validatePriceLimits(optimalPrice, item);

    // Aplicar mudança se significativa
    if (Math.abs(finalPrice - item.price) / item.price > 0.02) { // 2% threshold
      await this.applyPriceChange(itemId, finalPrice, strategies);
    }

    return {
      currentPrice: item.price,
      suggestedPrice: finalPrice,
      strategy: strategies,
      expectedImpact: this.calculateImpact(item, finalPrice)
    };
  }

  competitivePricing(item, competitors) {
    const avgPrice = competitors.reduce((sum, c) => sum + c.price, 0) / competitors.length;
    const medianPrice = competitors.sort((a, b) => a.price - b.price)[Math.floor(competitors.length / 2)]?.price;

    // Posicionamento baseado em reputação
    const reputationScore = item.seller_reputation?.level_id || 'green';
    const positionMultiplier = {
      'green': 0.95,      // Novo vendedor - preço competitivo
      'yellow': 0.98,     // Vendedor médio - próximo à média
      'light_green': 1.0, // Bom vendedor - na média
      'dark_green': 1.02  // Excelente - pode cobrar premium
    }[reputationScore];

    return {
      price: medianPrice * positionMultiplier,
      confidence: 0.85,
      reasoning: 'Baseado em análise competitiva e reputação'
    };
  }

  demandBasedPricing(item, demand) {
    const elasticity = this.calculatePriceElasticity(demand);

    // Alta demanda = aumentar preço
    // Baixa demanda = reduzir preço
    const demandMultiplier = 1 + (demand.trend * 0.1);
    const elasticityAdjustment = elasticity < -1 ? 0.95 : 1.05; // Elástico vs inelástico

    return {
      price: item.price * demandMultiplier * elasticityAdjustment,
      confidence: 0.75,
      reasoning: `Demanda ${demand.level}, elasticidade ${elasticity.toFixed(2)}`
    };
  }

  profitMaximization(item, costs, demand) {
    // Calcular preço ótimo para maximizar lucro
    // Profit = (Price - Cost) * Quantity
    // Quantity = f(Price) baseado na curva de demanda

    const costPerUnit = costs.product + costs.shipping + costs.fees;
    const demandCurve = demand.curve; // Array de [price, expectedQuantity]

    let maxProfit = 0;
    let optimalPrice = item.price;

    demandCurve.forEach(point => {
      const profit = (point.price - costPerUnit) * point.quantity;
      if (profit > maxProfit) {
        maxProfit = profit;
        optimalPrice = point.price;
      }
    });

    return {
      price: optimalPrice,
      confidence: 0.9,
      reasoning: `Maximização de lucro: R$ ${maxProfit.toFixed(2)}`
    };
  }

  psychologicalPricing(currentPrice) {
    // Aplicar preços psicológicos (9.99, 19.90, etc)
    const ranges = [
      { max: 10, end: 0.99 },
      { max: 50, end: 0.90 },
      { max: 100, end: 9.90 },
      { max: 500, end: 9.00 },
      { max: 1000, end: 90.00 },
      { max: Infinity, end: 900.00 }
    ];

    const range = ranges.find(r => currentPrice <= r.max);
    const base = Math.floor(currentPrice / 10) * 10;

    return {
      price: base + range.end,
      confidence: 0.7,
      reasoning: 'Precificação psicológica'
    };
  }

  timeDynamicPricing(item) {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    // Análise histórica de vendas por horário
    const peakHours = [10, 11, 12, 14, 15, 20, 21]; // Horários de pico
    const weekendMultiplier = [0, 6].includes(dayOfWeek) ? 1.05 : 1.0;
    const hourMultiplier = peakHours.includes(hour) ? 1.03 : 0.98;

    // Eventos especiais
    const specialEvents = this.checkSpecialEvents();
    const eventMultiplier = specialEvents.active ? specialEvents.multiplier : 1.0;

    return {
      price: item.price * weekendMultiplier * hourMultiplier * eventMultiplier,
      confidence: 0.65,
      reasoning: `Ajuste temporal: ${weekendMultiplier * hourMultiplier * eventMultiplier}`
    };
  }

  async applyPriceChange(itemId, newPrice, strategy) {
    // Registrar mudança
    await db.prepare(`
      INSERT INTO price_changes (
        item_id, old_price, new_price,
        strategy, reasoning, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      itemId,
      item.price,
      newPrice,
      JSON.stringify(strategy),
      strategy.reasoning,
      new Date().toISOString()
    );

    // Aplicar mudança
    await mlApi.updateItem(itemId, { price: newPrice });

    // Agendar revisão
    setTimeout(() => this.reviewPriceChange(itemId, newPrice), 3600000); // 1 hora
  }

  async reviewPriceChange(itemId, appliedPrice) {
    // Analisar impacto da mudança
    const metrics = await this.getMetricsAfterChange(itemId);

    if (metrics.conversion < metrics.previousConversion * 0.8) {
      // Reversão se conversão caiu muito
      await this.optimizePrice(itemId);
    }
  }
}

// Scheduler para otimização automática
async function schedulePriceOptimization() {
  const engine = new DynamicPricingEngine();

  // Executar a cada hora
  setInterval(async () => {
    const items = await getActiveItems();

    for (const item of items) {
      if (item.pricing_automation_enabled) {
        try {
          await engine.optimizePrice(item.id);
        } catch (error) {
          console.error(`Erro ao otimizar preço de ${item.id}:`, error);
        }
      }
    }
  }, 3600000); // 1 hora
}
```

### 3.3 Republicação Inteligente

#### O que faria:
- Identificar anúncios estagnados
- Republicar automaticamente
- Otimizar horário de publicação
- Melhorar título e descrição

#### Como implementar:

**Novo arquivo: `backend/mcp/automations/smartRepublisher.js`**
```javascript
class SmartRepublisher {
  async analyzeForRepublish(itemId) {
    const item = await mlApi.getItem(itemId);
    const visits = await mlApi.getItemVisits(itemId);
    const metrics = await this.calculateMetrics(item, visits);

    const score = this.calculateRepublishScore(metrics);

    if (score > 0.7) {
      return await this.republishWithOptimizations(item);
    }

    return { shouldRepublish: false, score, reasons: metrics.issues };
  }

  calculateRepublishScore(metrics) {
    let score = 0;

    // Critérios para republicação
    if (metrics.daysSinceCreated > 60) score += 0.3;
    if (metrics.visitsLast7Days < 10) score += 0.3;
    if (metrics.conversionRate < 0.01) score += 0.2;
    if (metrics.daysWithoutSale > 30) score += 0.2;
    if (metrics.positionInSearch > 50) score += 0.2;

    return Math.min(score, 1.0);
  }

  async republishWithOptimizations(item) {
    // 1. Otimizar título
    const optimizedTitle = await this.optimizeTitle(item.title, item.category_id);

    // 2. Melhorar descrição
    const optimizedDescription = await this.optimizeDescription(
      item.description,
      item.attributes
    );

    // 3. Verificar e otimizar fotos
    const photoSuggestions = await this.analyzePhotos(item.pictures);

    // 4. Determinar melhor horário
    const optimalTime = await this.findOptimalPublishTime(item.category_id);

    // 5. Aguardar horário ideal se necessário
    const delay = this.calculateDelay(optimalTime);
    if (delay > 0) {
      setTimeout(() => this.executeRepublish(item, optimizations), delay);
      return {
        scheduled: true,
        scheduledFor: optimalTime,
        optimizations: { title: optimizedTitle, description: optimizedDescription }
      };
    }

    // 6. Executar republicação
    return await this.executeRepublish(item, {
      title: optimizedTitle,
      description: optimizedDescription
    });
  }

  async optimizeTitle(currentTitle, categoryId) {
    // Buscar palavras-chave populares
    const topKeywords = await this.getTopKeywords(categoryId);

    // Usar IA para melhorar título
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `Otimize este título de produto para Mercado Livre.
                   Use estas palavras-chave populares: ${topKeywords.join(', ')}.
                   Máximo 60 caracteres. Seja direto e atrativo.`
        },
        { role: "user", content: currentTitle }
      ]
    });

    return response.choices[0].message.content;
  }

  async optimizeDescription(currentDescription, attributes) {
    const template = `
      🎯 CARACTERÍSTICAS PRINCIPAIS:
      ${attributes.map(a => `• ${a.name}: ${a.value_name}`).join('\n')}

      📦 O QUE VOCÊ RECEBE:
      ${this.extractIncludes(currentDescription)}

      ✨ DIFERENCIAIS:
      ${this.extractBenefits(currentDescription)}

      🚚 ENVIO E GARANTIA:
      • Envio imediato
      • Garantia de 90 dias
      • Suporte pós-venda

      ${currentDescription}
    `;

    return template;
  }

  async executeRepublish(item, optimizations) {
    // Fechar anúncio original
    await mlApi.changeItemStatus(item.id, 'closed');

    // Criar novo anúncio otimizado
    const newItem = await mlApi.createItem({
      ...item,
      title: optimizations.title || item.title,
      description: { plain_text: optimizations.description || item.description },
      // Resetar métricas
      sold_quantity: 0,
      visits: 0
    });

    // Registrar republicação
    await db.prepare(`
      INSERT INTO republications (
        original_id, new_id, optimizations,
        timestamp
      ) VALUES (?, ?, ?, ?)
    `).run(
      item.id,
      newItem.id,
      JSON.stringify(optimizations),
      new Date().toISOString()
    );

    return {
      success: true,
      originalId: item.id,
      newId: newItem.id,
      optimizations,
      link: newItem.permalink
    };
  }

  async findOptimalPublishTime(categoryId) {
    // Analisar histórico de vendas da categoria
    const salesByHour = await db.prepare(`
      SELECT
        strftime('%H', created_at) as hour,
        COUNT(*) as sales
      FROM orders_history o
      JOIN items i ON o.item_id = i.id
      WHERE i.category_id = ?
      GROUP BY hour
      ORDER BY sales DESC
    `).all(categoryId);

    const bestHour = parseInt(salesByHour[0]?.hour || 10);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(bestHour, 0, 0, 0);

    return tomorrow;
  }
}

// Agendador automático
async function scheduleSmartRepublishing() {
  const republisher = new SmartRepublisher();

  // Verificar diariamente às 3h da manhã
  const scheduledHour = 3;
  const now = new Date();
  const scheduledTime = new Date(now);
  scheduledTime.setHours(scheduledHour, 0, 0, 0);

  if (scheduledTime < now) {
    scheduledTime.setDate(scheduledTime.getDate() + 1);
  }

  const delay = scheduledTime - now;

  setTimeout(async () => {
    // Executar verificação
    const items = await getActiveItems();

    for (const item of items) {
      if (item.auto_republish_enabled) {
        const result = await republisher.analyzeForRepublish(item.id);

        if (result.shouldRepublish || result.scheduled) {
          console.log(`Republicação ${result.scheduled ? 'agendada' : 'executada'} para ${item.id}`);
        }
      }
    }

    // Reagendar para o próximo dia
    scheduleSmartRepublishing();
  }, delay);
}
```

### 3.4 Gestão de Estoque

#### O que faria:
- Monitorar níveis de estoque
- Alertar reposição necessária
- Sincronizar com múltiplos canais
- Prever demanda futura

#### Como implementar:

**Novo arquivo: `backend/mcp/automations/stockManager.js`**
```javascript
class StockManager {
  async monitorStock() {
    const items = await this.getItemsWithLowStock();

    for (const item of items) {
      await this.processStockItem(item);
    }
  }

  async processStockItem(item) {
    const analysis = {
      current: item.available_quantity,
      salesVelocity: await this.calculateSalesVelocity(item.id),
      daysUntilOut: this.calculateDaysUntilOut(item),
      reorderPoint: await this.calculateReorderPoint(item.id),
      suggestedQuantity: await this.calculateOptimalStock(item.id)
    };

    // Tomar ações baseadas na análise
    if (analysis.current <= analysis.reorderPoint) {
      await this.triggerReorder(item, analysis);
    }

    if (analysis.daysUntilOut <= 3) {
      await this.sendUrgentAlert(item, analysis);
    }

    if (analysis.current === 0) {
      await this.handleOutOfStock(item);
    }

    return analysis;
  }

  async calculateSalesVelocity(itemId) {
    const sales = await db.prepare(`
      SELECT COUNT(*) as total,
             julianday('now') - julianday(MIN(created_at)) as days
      FROM orders_history
      WHERE item_id = ?
      AND created_at > date('now', '-30 days')
    `).get(itemId);

    return sales.total / (sales.days || 30);
  }

  async calculateOptimalStock(itemId) {
    const velocity = await this.calculateSalesVelocity(itemId);
    const leadTime = 7; // dias para reposição
    const safetyDays = 5; // margem de segurança

    return Math.ceil(velocity * (leadTime + safetyDays));
  }

  async triggerReorder(item, analysis) {
    // Criar ordem de reposição
    const reorder = await db.prepare(`
      INSERT INTO reorder_requests (
        item_id, current_stock, suggested_quantity,
        sales_velocity, status, created_at
      ) VALUES (?, ?, ?, ?, 'pending', ?)
    `).run(
      item.id,
      analysis.current,
      analysis.suggestedQuantity,
      analysis.salesVelocity,
      new Date().toISOString()
    );

    // Notificar fornecedor/administrador
    await this.sendReorderNotification({
      item,
      quantity: analysis.suggestedQuantity,
      urgency: analysis.daysUntilOut <= 7 ? 'high' : 'normal'
    });

    return reorder;
  }

  async handleOutOfStock(item) {
    // Opção 1: Pausar anúncio temporariamente
    if (item.pause_when_out_of_stock) {
      await mlApi.changeItemStatus(item.id, 'paused');

      await db.prepare(`
        INSERT INTO stock_events (
          item_id, event_type, description, timestamp
        ) VALUES (?, 'auto_paused', 'Pausado por falta de estoque', ?)
      `).run(item.id, new Date().toISOString());
    }

    // Opção 2: Ativar pré-venda
    if (item.enable_presale) {
      const restockDate = await this.estimateRestockDate(item.id);

      await mlApi.updateItem(item.id, {
        title: `[PRÉ-VENDA] ${item.title}`,
        available_quantity: item.presale_limit || 10,
        sale_terms: [
          {
            id: 'MANUFACTURING_TIME',
            value_name: `${restockDate.days} dias`
          }
        ]
      });
    }

    // Notificar vendedor
    await this.sendOutOfStockAlert(item);
  }

  // Sincronização multi-canal
  async syncMultiChannel(itemId) {
    const channels = await db.prepare(`
      SELECT * FROM sales_channels
      WHERE item_id = ? AND sync_enabled = 1
    `).all(itemId);

    const mlStock = await mlApi.getItem(itemId);
    let totalReserved = 0;

    for (const channel of channels) {
      const channelStock = await this.getChannelStock(channel);
      totalReserved += channelStock.reserved;
    }

    // Distribuir estoque entre canais
    const availableForML = Math.max(0, mlStock.available_quantity - totalReserved);

    if (availableForML !== mlStock.available_quantity) {
      await mlApi.updateItem(itemId, {
        available_quantity: availableForML
      });
    }

    return {
      total: mlStock.available_quantity,
      reserved: totalReserved,
      available: availableForML,
      channels: channels.length
    };
  }
}

// Monitor em tempo real
class RealTimeStockMonitor {
  constructor() {
    this.websocket = null;
    this.items = new Map();
  }

  async start() {
    // Conectar ao webhook de vendas
    this.websocket = new WebSocket('wss://ml-webhooks.com/stock');

    this.websocket.on('message', async (data) => {
      const event = JSON.parse(data);

      if (event.type === 'order') {
        await this.handleSale(event);
      }
    });
  }

  async handleSale(event) {
    const item = this.items.get(event.item_id);

    if (item) {
      item.stock -= event.quantity;

      // Verificar níveis críticos
      if (item.stock <= item.criticalLevel) {
        await this.triggerCriticalStockAlert(item);
      }

      // Atualizar previsão
      await this.updateDemandForecast(event.item_id, event);
    }
  }
}
```

---

## 4. INTEGRAÇÃO COM MCP REMOTO DO ML

### 4.1 Configurar Credenciais

#### O que faria:
- Conectar com servidor MCP oficial
- Autenticar com credenciais do app
- Sincronizar tokens
- Validar conexão

#### Como implementar:

**Configuração: `.env`**
```env
# Credenciais do Mercado Livre
ML_APP_ID=seu_app_id_aqui
ML_SECRET=seu_secret_aqui
ML_REDIRECT_URI=http://localhost:3001/api/auth/callback

# MCP Remoto
MCP_REMOTE_URL=https://mcp.mercadolibre.com/mcp
MCP_API_KEY=sua_api_key_mcp
```

**Novo arquivo: `backend/mcp/remote/connector.js`**
```javascript
const axios = require('axios');
const WebSocket = require('ws');

class MCPRemoteConnector {
  constructor() {
    this.baseURL = process.env.MCP_REMOTE_URL;
    this.apiKey = process.env.MCP_API_KEY;
    this.ws = null;
    this.authenticated = false;
  }

  async initialize() {
    // 1. Autenticar com MCP remoto
    await this.authenticate();

    // 2. Estabelecer conexão WebSocket
    await this.connectWebSocket();

    // 3. Sincronizar ferramentas disponíveis
    await this.syncTools();

    // 4. Validar conexão
    await this.validateConnection();

    return this.authenticated;
  }

  async authenticate() {
    try {
      const response = await axios.post(`${this.baseURL}/auth`, {
        app_id: process.env.ML_APP_ID,
        secret: process.env.ML_SECRET,
        api_key: this.apiKey
      });

      this.sessionToken = response.data.session_token;
      this.authenticated = true;

      console.log('✅ Autenticado com MCP remoto');

      // Renovar token periodicamente
      setInterval(() => this.refreshSession(), 3600000); // 1 hora

    } catch (error) {
      console.error('❌ Erro na autenticação MCP:', error);
      throw error;
    }
  }

  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`wss://mcp.mercadolibre.com/ws`, {
        headers: {
          'Authorization': `Bearer ${this.sessionToken}`,
          'X-API-Key': this.apiKey
        }
      });

      this.ws.on('open', () => {
        console.log('✅ WebSocket conectado ao MCP');
        this.setupEventHandlers();
        resolve();
      });

      this.ws.on('error', (error) => {
        console.error('❌ Erro WebSocket:', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('⚠️ WebSocket desconectado, tentando reconectar...');
        setTimeout(() => this.connectWebSocket(), 5000);
      });
    });
  }

  setupEventHandlers() {
    this.ws.on('message', (data) => {
      const message = JSON.parse(data.toString());

      switch(message.type) {
        case 'tool_response':
          this.handleToolResponse(message);
          break;
        case 'notification':
          this.handleNotification(message);
          break;
        case 'error':
          this.handleError(message);
          break;
      }
    });
  }

  async syncTools() {
    const response = await axios.get(`${this.baseURL}/tools`, {
      headers: { 'Authorization': `Bearer ${this.sessionToken}` }
    });

    this.availableTools = response.data.tools;

    console.log(`✅ ${this.availableTools.length} ferramentas sincronizadas do MCP`);

    // Registrar ferramentas localmente
    this.availableTools.forEach(tool => {
      this.registerTool(tool);
    });
  }

  registerTool(tool) {
    // Criar wrapper para ferramenta remota
    const wrapper = {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      execute: async (params) => {
        return await this.callRemoteTool(tool.name, params);
      }
    };

    // Registrar no sistema local
    global.mcpTools[`remote_${tool.name}`] = wrapper;
  }

  async callRemoteTool(toolName, parameters) {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();

      // Registrar callback
      this.pendingRequests.set(requestId, { resolve, reject });

      // Enviar requisição
      this.ws.send(JSON.stringify({
        type: 'tool_request',
        request_id: requestId,
        tool: toolName,
        parameters
      }));

      // Timeout de 30 segundos
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Timeout na chamada MCP'));
        }
      }, 30000);
    });
  }

  handleToolResponse(message) {
    const { request_id, result, error } = message;
    const pending = this.pendingRequests.get(request_id);

    if (pending) {
      if (error) {
        pending.reject(new Error(error));
      } else {
        pending.resolve(result);
      }
      this.pendingRequests.delete(request_id);
    }
  }

  async validateConnection() {
    try {
      // Fazer chamada de teste
      const result = await this.callRemoteTool('ping', {});

      if (result.status === 'ok') {
        console.log('✅ Conexão MCP validada');
        return true;
      }
    } catch (error) {
      console.error('❌ Falha na validação:', error);
      return false;
    }
  }
}

module.exports = MCPRemoteConnector;
```

### 4.2 Testar Ferramentas Nativas

#### O que faria:
- Listar ferramentas disponíveis
- Executar testes de cada ferramenta
- Validar respostas
- Benchmark de performance

#### Como implementar:

**Novo arquivo: `backend/mcp/remote/tester.js`**
```javascript
class MCPToolsTester {
  constructor(connector) {
    this.connector = connector;
    this.results = [];
  }

  async runFullTest() {
    console.log('🧪 Iniciando testes do MCP remoto...\n');

    const tools = this.connector.availableTools;

    for (const tool of tools) {
      await this.testTool(tool);
    }

    this.printReport();
    return this.results;
  }

  async testTool(tool) {
    console.log(`Testing: ${tool.name}`);

    const testCases = this.generateTestCases(tool);
    const toolResults = {
      name: tool.name,
      tests: [],
      avgResponseTime: 0,
      successRate: 0
    };

    for (const testCase of testCases) {
      const start = Date.now();

      try {
        const result = await this.connector.callRemoteTool(
          tool.name,
          testCase.params
        );

        const responseTime = Date.now() - start;

        toolResults.tests.push({
          case: testCase.name,
          success: true,
          responseTime,
          result: this.validateResult(result, testCase.expected)
        });

      } catch (error) {
        toolResults.tests.push({
          case: testCase.name,
          success: false,
          error: error.message
        });
      }
    }

    // Calcular métricas
    const successfulTests = toolResults.tests.filter(t => t.success);
    toolResults.successRate = (successfulTests.length / toolResults.tests.length) * 100;
    toolResults.avgResponseTime = successfulTests.reduce((sum, t) =>
      sum + t.responseTime, 0) / successfulTests.length;

    this.results.push(toolResults);
  }

  generateTestCases(tool) {
    // Gerar casos de teste baseado no tipo de ferramenta
    const testCases = [];

    switch(tool.category) {
      case 'search':
        testCases.push({
          name: 'Busca simples',
          params: { query: 'iPhone', limit: 5 },
          expected: { hasResults: true }
        });
        testCases.push({
          name: 'Busca com filtros',
          params: {
            query: 'notebook',
            price_min: 1000,
            price_max: 5000,
            condition: 'new'
          },
          expected: { hasResults: true }
        });
        break;

      case 'analysis':
        testCases.push({
          name: 'Análise de item',
          params: { item_id: 'MLB1234567890' },
          expected: { hasMetrics: true }
        });
        break;

      case 'pricing':
        testCases.push({
          name: 'Sugestão de preço',
          params: {
            title: 'iPhone 13 128GB',
            category: 'MLB1055'
          },
          expected: { hasSuggestion: true }
        });
        break;
    }

    return testCases;
  }

  validateResult(result, expected) {
    let isValid = true;
    const validation = {};

    for (const [key, value] of Object.entries(expected)) {
      if (key === 'hasResults') {
        validation[key] = result.results && result.results.length > 0;
      } else if (key === 'hasMetrics') {
        validation[key] = result.metrics && Object.keys(result.metrics).length > 0;
      } else if (key === 'hasSuggestion') {
        validation[key] = result.suggested_price !== undefined;
      }

      if (!validation[key]) isValid = false;
    }

    return { isValid, validation };
  }

  printReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 RELATÓRIO DE TESTES MCP');
    console.log('='.repeat(60));

    this.results.forEach(tool => {
      console.log(`\n🔧 ${tool.name}`);
      console.log(`   Taxa de sucesso: ${tool.successRate.toFixed(1)}%`);
      console.log(`   Tempo médio: ${tool.avgResponseTime.toFixed(0)}ms`);

      tool.tests.forEach(test => {
        const icon = test.success ? '✅' : '❌';
        console.log(`   ${icon} ${test.case}`);
        if (!test.success) {
          console.log(`      Erro: ${test.error}`);
        }
      });
    });

    const overallSuccess = this.results.reduce((sum, t) =>
      sum + t.successRate, 0) / this.results.length;

    console.log('\n' + '='.repeat(60));
    console.log(`📈 Taxa geral de sucesso: ${overallSuccess.toFixed(1)}%`);
    console.log('='.repeat(60));
  }
}

// Executar teste
async function testMCPIntegration() {
  const connector = new MCPRemoteConnector();
  await connector.initialize();

  const tester = new MCPToolsTester(connector);
  const results = await tester.runFullTest();

  // Salvar resultados
  await fs.writeFile(
    'mcp-test-results.json',
    JSON.stringify(results, null, 2)
  );

  return results;
}
```

### 4.3 Combinar com MCP Local

#### O que faria:
- Unificar ferramentas locais e remotas
- Roteamento inteligente
- Fallback automático
- Cache de respostas

#### Como implementar:

**Novo arquivo: `backend/mcp/hybrid/orchestrator.js`**
```javascript
class HybridMCPOrchestrator {
  constructor() {
    this.localTools = require('../tools');
    this.remoteConnector = new MCPRemoteConnector();
    this.cache = new Map();
    this.metrics = {
      local: { calls: 0, avgTime: 0, errors: 0 },
      remote: { calls: 0, avgTime: 0, errors: 0 }
    };
  }

  async initialize() {
    // Conectar ao MCP remoto
    await this.remoteConnector.initialize();

    // Mapear capacidades
    this.mapCapabilities();

    // Iniciar monitor de saúde
    this.startHealthMonitor();
  }

  mapCapabilities() {
    this.capabilities = {
      // Ferramentas que funcionam melhor localmente
      local_preferred: [
        'listar_anuncios_fracos',
        'alterar_preco',
        'pausar_anuncio',
        'reativar_anuncio'
      ],

      // Ferramentas que funcionam melhor remotamente
      remote_preferred: [
        'market_analysis',
        'competitor_tracking',
        'trend_prediction',
        'category_suggestion'
      ],

      // Ferramentas disponíveis em ambos
      hybrid: [
        'analisar_anuncio',
        'sugerir_melhorias',
        'resumo_vendas'
      ]
    };
  }

  async executeTool(toolName, parameters, options = {}) {
    const startTime = Date.now();

    // Verificar cache
    const cacheKey = this.getCacheKey(toolName, parameters);
    if (!options.skipCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 300000) { // 5 minutos
        return cached.result;
      }
    }

    // Determinar onde executar
    const location = this.determineLocation(toolName, options);

    try {
      let result;

      if (location === 'local') {
        result = await this.executeLocal(toolName, parameters);
        this.updateMetrics('local', Date.now() - startTime);
      } else if (location === 'remote') {
        result = await this.executeRemote(toolName, parameters);
        this.updateMetrics('remote', Date.now() - startTime);
      } else {
        // Hybrid: tentar ambos e comparar
        result = await this.executeHybrid(toolName, parameters);
      }

      // Cachear resultado
      this.cache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });

      return result;

    } catch (error) {
      // Fallback automático
      if (location === 'remote' && this.localTools[toolName]) {
        console.log(`⚠️ Fallback para local: ${toolName}`);
        return await this.executeLocal(toolName, parameters);
      } else if (location === 'local' && this.remoteConnector.availableTools.includes(toolName)) {
        console.log(`⚠️ Fallback para remoto: ${toolName}`);
        return await this.executeRemote(toolName, parameters);
      }

      throw error;
    }
  }

  determineLocation(toolName, options) {
    // Prioridade: opção explícita > preferência > disponibilidade

    if (options.forceLocal) return 'local';
    if (options.forceRemote) return 'remote';

    if (this.capabilities.local_preferred.includes(toolName)) {
      return 'local';
    }

    if (this.capabilities.remote_preferred.includes(toolName)) {
      return 'remote';
    }

    if (this.capabilities.hybrid.includes(toolName)) {
      // Decidir baseado em métricas
      return this.selectBestLocation(toolName);
    }

    // Default: verificar disponibilidade
    if (this.localTools[toolName]) return 'local';
    if (this.remoteConnector.availableTools.includes(toolName)) return 'remote';

    throw new Error(`Ferramenta não encontrada: ${toolName}`);
  }

  selectBestLocation(toolName) {
    // Decisão baseada em performance e disponibilidade

    const localScore = this.calculateScore('local');
    const remoteScore = this.calculateScore('remote');

    // Considerar saúde dos serviços
    if (!this.remoteConnector.authenticated) return 'local';
    if (this.metrics.remote.errors > 5) return 'local';

    // Considerar latência
    if (this.metrics.remote.avgTime > this.metrics.local.avgTime * 2) {
      return 'local';
    }

    return remoteScore > localScore ? 'remote' : 'local';
  }

  async executeHybrid(toolName, parameters) {
    // Executar em ambos e combinar resultados
    const [localResult, remoteResult] = await Promise.allSettled([
      this.executeLocal(toolName, parameters),
      this.executeRemote(toolName, parameters)
    ]);

    // Combinar inteligentemente
    if (localResult.status === 'fulfilled' && remoteResult.status === 'fulfilled') {
      return this.mergeResults(localResult.value, remoteResult.value);
    } else if (localResult.status === 'fulfilled') {
      return localResult.value;
    } else if (remoteResult.status === 'fulfilled') {
      return remoteResult.value;
    } else {
      throw new Error('Ambas execuções falharam');
    }
  }

  mergeResults(local, remote) {
    // Estratégia de merge depende do tipo de dado
    if (Array.isArray(local) && Array.isArray(remote)) {
      // Combinar e remover duplicados
      const combined = [...local, ...remote];
      return this.removeDuplicates(combined);
    }

    if (typeof local === 'object' && typeof remote === 'object') {
      // Merge de objetos, priorizando remote para dados mais recentes
      return { ...local, ...remote, _sources: ['local', 'remote'] };
    }

    // Para valores simples, preferir remote (geralmente mais atualizado)
    return remote;
  }

  startHealthMonitor() {
    setInterval(async () => {
      // Verificar saúde local
      try {
        await this.executeLocal('ping', {});
        this.localHealth = 'healthy';
      } catch {
        this.localHealth = 'unhealthy';
      }

      // Verificar saúde remota
      try {
        await this.remoteConnector.callRemoteTool('ping', {});
        this.remoteHealth = 'healthy';
      } catch {
        this.remoteHealth = 'unhealthy';
      }

      // Limpar cache antigo
      this.cleanCache();

    }, 60000); // A cada minuto
  }

  getStatus() {
    return {
      local: {
        health: this.localHealth,
        metrics: this.metrics.local,
        toolsCount: Object.keys(this.localTools).length
      },
      remote: {
        health: this.remoteHealth,
        metrics: this.metrics.remote,
        toolsCount: this.remoteConnector.availableTools.length,
        connected: this.remoteConnector.authenticated
      },
      cache: {
        size: this.cache.size,
        hitRate: this.calculateCacheHitRate()
      },
      capabilities: this.capabilities
    };
  }
}

module.exports = HybridMCPOrchestrator;
```

---

## 5. WEBHOOKS

### 5.1 Implementar Endpoint para Receber Notificações

#### O que faria:
- Receber eventos do ML em tempo real
- Validar assinatura de segurança
- Processar diferentes tipos de eventos
- Enfileirar para processamento

#### Como implementar:

**Novo arquivo: `backend/routes/webhooks.js`**
```javascript
const crypto = require('crypto');
const Queue = require('bull');

// Criar filas para diferentes tipos de eventos
const queues = {
  items: new Queue('items-webhook'),
  orders: new Queue('orders-webhook'),
  questions: new Queue('questions-webhook'),
  messages: new Queue('messages-webhook'),
  payments: new Queue('payments-webhook'),
  claims: new Queue('claims-webhook')
};

// POST /api/webhooks/ml
router.post('/ml', async (req, res) => {
  try {
    // 1. Validar assinatura (se configurado)
    if (process.env.ML_WEBHOOK_SECRET) {
      const signature = req.headers['x-ml-signature'];
      if (!validateSignature(req.body, signature)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // 2. Responder imediatamente ao ML (requisito)
    res.status(200).send('OK');

    // 3. Processar evento assincronamente
    const { topic, resource, user_id, application_id } = req.body;

    // Registrar evento
    await db.prepare(`
      INSERT INTO webhook_events (
        topic, resource, user_id,
        application_id, payload, received_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      topic,
      resource,
      user_id,
      application_id,
      JSON.stringify(req.body),
      new Date().toISOString()
    );

    // Enfileirar para processamento
    const queue = queues[topic];
    if (queue) {
      await queue.add('process', {
        ...req.body,
        received_at: Date.now()
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      });
    }

  } catch (error) {
    console.error('Erro no webhook:', error);
    // Não retornar erro para o ML
    res.status(200).send('OK');
  }
});

function validateSignature(payload, signature) {
  const secret = process.env.ML_WEBHOOK_SECRET;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expectedSignature = hmac.digest('hex');

  return signature === `sha256=${expectedSignature}`;
}

// Configurar processadores para cada fila
queues.items.process('process', async (job) => {
  const { resource, user_id } = job.data;

  // Extrair ID do item da resource URL
  const itemId = resource.split('/').pop();

  // Buscar dados atualizados
  const mlApi = await tokenManager.getApiClient(user_id);
  const item = await mlApi.getItem(itemId);

  // Processar mudanças
  await processItemChanges(item, job.data);
});

queues.orders.process('process', async (job) => {
  const { resource, user_id } = job.data;
  const orderId = resource.split('/').pop();

  const mlApi = await tokenManager.getApiClient(user_id);
  const order = await mlApi.getOrder(orderId);

  // Processar nova venda
  await processNewOrder(order);

  // Notificar vendedor
  await notifyNewSale(order);

  // Atualizar métricas
  await updateSalesMetrics(order);
});

queues.questions.process('process', async (job) => {
  const { resource } = job.data;
  const questionId = resource.split('/').pop();

  // Auto-responder se configurado
  if (process.env.AUTO_ANSWER_ENABLED === 'true') {
    const autoResponder = new AutoResponder();
    await autoResponder.handleQuestionWebhook(job.data);
  } else {
    // Notificar vendedor
    await notifyNewQuestion(questionId);
  }
});

queues.messages.process('process', async (job) => {
  const { resource } = job.data;

  // Processar nova mensagem
  await processMessage(resource);

  // Notificar em tempo real via WebSocket
  io.emit('new_message', {
    resource,
    timestamp: job.data.received_at
  });
});

queues.payments.process('process', async (job) => {
  const { resource } = job.data;
  const paymentId = resource.split('/').pop();

  // Atualizar status do pagamento
  await updatePaymentStatus(paymentId);

  // Se aprovado, liberar produto
  const payment = await getPaymentDetails(paymentId);
  if (payment.status === 'approved') {
    await releaseProductForShipping(payment.order_id);
  }
});

queues.claims.process('process', async (job) => {
  const { resource } = job.data;
  const claimId = resource.split('/').pop();

  // Processar reclamação
  await processClaim(claimId);

  // Alerta urgente para o vendedor
  await sendUrgentAlert({
    type: 'new_claim',
    claim_id: claimId,
    priority: 'high'
  });
});

module.exports = router;
```

### 5.2 Processar Eventos em Tempo Real

#### O que faria:
- Processar eventos instantaneamente
- Atualizar estado local
- Disparar ações automáticas
- Notificar usuários conectados

#### Como implementar:

**Novo arquivo: `backend/services/realtimeProcessor.js`**
```javascript
const EventEmitter = require('events');
const io = require('socket.io')(server);

class RealtimeEventProcessor extends EventEmitter {
  constructor() {
    super();
    this.subscribers = new Map();
    this.setupSocketIO();
  }

  setupSocketIO() {
    io.on('connection', (socket) => {
      console.log('Cliente conectado:', socket.id);

      socket.on('subscribe', (topics) => {
        topics.forEach(topic => {
          socket.join(`topic:${topic}`);
        });
        this.subscribers.set(socket.id, topics);
      });

      socket.on('disconnect', () => {
        this.subscribers.delete(socket.id);
      });
    });
  }

  async processItemChange(item, webhookData) {
    const changes = await this.detectChanges(item);

    // Atualizar banco local
    await db.prepare(`
      INSERT INTO items_history (
        item_id, snapshot, changes, timestamp
      ) VALUES (?, ?, ?, ?)
    `).run(
      item.id,
      JSON.stringify(item),
      JSON.stringify(changes),
      new Date().toISOString()
    );

    // Disparar eventos baseado nas mudanças
    if (changes.price) {
      this.emit('price_changed', { item, oldPrice: changes.price.old, newPrice: changes.price.new });
    }

    if (changes.status) {
      this.emit('status_changed', { item, oldStatus: changes.status.old, newStatus: changes.status.new });
    }

    if (changes.stock && item.available_quantity === 0) {
      this.emit('out_of_stock', { item });
    }

    // Notificar clientes via WebSocket
    io.to(`topic:items`).emit('item_updated', {
      item_id: item.id,
      changes,
      timestamp: Date.now()
    });

    // Executar ações automáticas
    await this.executeAutomations(item, changes);
  }

  async detectChanges(newItem) {
    const oldItem = await db.prepare(`
      SELECT snapshot FROM items_history
      WHERE item_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(newItem.id);

    if (!oldItem) return {};

    const old = JSON.parse(oldItem.snapshot);
    const changes = {};

    // Detectar mudanças em campos importantes
    const fieldsToTrack = ['price', 'status', 'available_quantity', 'title'];

    fieldsToTrack.forEach(field => {
      if (old[field] !== newItem[field]) {
        changes[field] = {
          old: old[field],
          new: newItem[field]
        };
      }
    });

    return changes;
  }

  async executeAutomations(item, changes) {
    const automations = await db.prepare(`
      SELECT * FROM automations
      WHERE item_id = ? AND enabled = 1
    `).all(item.id);

    for (const automation of automations) {
      if (this.shouldTrigger(automation, changes)) {
        await this.runAutomation(automation, item, changes);
      }
    }
  }

  shouldTrigger(automation, changes) {
    const conditions = JSON.parse(automation.conditions);

    return conditions.some(condition => {
      switch(condition.type) {
        case 'price_drop':
          return changes.price && changes.price.new < changes.price.old;

        case 'competitor_price_change':
          return changes.competitor_price !== undefined;

        case 'low_stock':
          return changes.available_quantity && changes.available_quantity.new <= condition.threshold;

        case 'status_change':
          return changes.status && changes.status.new === condition.value;

        default:
          return false;
      }
    });
  }

  async runAutomation(automation, item, changes) {
    const actions = JSON.parse(automation.actions);

    for (const action of actions) {
      try {
        switch(action.type) {
          case 'adjust_price':
            await this.adjustPrice(item, action.params);
            break;

          case 'send_notification':
            await this.sendNotification(action.params);
            break;

          case 'pause_item':
            await mlApi.changeItemStatus(item.id, 'paused');
            break;

          case 'restock_alert':
            await this.sendRestockAlert(item);
            break;

          case 'republish':
            await this.republishItem(item);
            break;
        }

        // Registrar execução
        await db.prepare(`
          INSERT INTO automation_logs (
            automation_id, item_id, action,
            result, timestamp
          ) VALUES (?, ?, ?, 'success', ?)
        `).run(
          automation.id,
          item.id,
          action.type,
          new Date().toISOString()
        );

      } catch (error) {
        console.error('Erro na automação:', error);

        await db.prepare(`
          INSERT INTO automation_logs (
            automation_id, item_id, action,
            result, error, timestamp
          ) VALUES (?, ?, ?, 'error', ?, ?)
        `).run(
          automation.id,
          item.id,
          action.type,
          error.message,
          new Date().toISOString()
        );
      }
    }
  }

  // Processamento de vendas em tempo real
  async processNewOrder(order) {
    // 1. Atualizar estatísticas instantaneamente
    await this.updateRealTimeStats(order);

    // 2. Verificar metas
    await this.checkSalesGoals(order);

    // 3. Atualizar ranking de produtos
    await this.updateProductRanking(order);

    // 4. Notificar dashboard
    io.emit('new_sale', {
      order_id: order.id,
      amount: order.total_amount,
      items: order.order_items,
      buyer: order.buyer.nickname,
      timestamp: order.date_created
    });

    // 5. Celebração especial para marcos
    const totalSales = await this.getTotalSales();
    if (totalSales % 100 === 0) {
      io.emit('milestone', {
        type: 'sales',
        number: totalSales,
        message: `🎉 ${totalSales}ª venda realizada!`
      });
    }
  }

  async updateRealTimeStats(order) {
    const stats = await this.getCurrentStats();

    stats.sales_today += 1;
    stats.revenue_today += order.total_amount;
    stats.items_sold_today += order.order_items.length;

    await this.saveStats(stats);

    // Broadcast para dashboards conectados
    io.to('topic:stats').emit('stats_updated', stats);
  }

  async checkSalesGoals(order) {
    const goals = await db.prepare(`
      SELECT * FROM sales_goals
      WHERE active = 1 AND end_date >= date('now')
    `).all();

    for (const goal of goals) {
      const progress = await this.calculateGoalProgress(goal);

      if (progress >= goal.target && !goal.achieved) {
        // Meta atingida!
        await db.prepare(`
          UPDATE sales_goals
          SET achieved = 1, achieved_at = ?
          WHERE id = ?
        `).run(new Date().toISOString(), goal.id);

        io.emit('goal_achieved', {
          goal: goal.name,
          target: goal.target,
          achieved: progress
        });
      }
    }
  }
}

module.exports = RealtimeEventProcessor;
```

### 5.3 Atualizar Dados Locais Automaticamente

#### O que faria:
- Sincronizar dados com ML
- Manter cache atualizado
- Resolver conflitos
- Backup incremental

#### Como implementar:

**Novo arquivo: `backend/services/dataSynchronizer.js`**
```javascript
class DataSynchronizer {
  constructor() {
    this.syncQueue = new Queue('data-sync');
    this.conflictResolver = new ConflictResolver();
    this.lastSync = {};
  }

  async startSync() {
    // Sincronização inicial completa
    await this.fullSync();

    // Sincronizações incrementais periódicas
    setInterval(() => this.incrementalSync(), 60000); // A cada minuto

    // Processar eventos de webhook
    this.processWebhookQueue();
  }

  async fullSync() {
    console.log('🔄 Iniciando sincronização completa...');

    const stores = await db.prepare('SELECT * FROM stores').all();

    for (const store of stores) {
      await this.syncStore(store);
    }

    console.log('✅ Sincronização completa finalizada');
  }

  async syncStore(store) {
    const mlApi = await tokenManager.getApiClient(store.id);

    // Sincronizar items
    await this.syncItems(store, mlApi);

    // Sincronizar pedidos
    await this.syncOrders(store, mlApi);

    // Sincronizar métricas
    await this.syncMetrics(store, mlApi);

    this.lastSync[store.id] = Date.now();
  }

  async syncItems(store, mlApi) {
    const remoteItems = await mlApi.getSellerItems(store.ml_user_id, {
      limit: 100,
      include_internal_attributes: true
    });

    for (const remoteItem of remoteItems.results) {
      const localItem = await db.prepare(`
        SELECT * FROM items WHERE ml_id = ?
      `).get(remoteItem);

      if (!localItem) {
        // Novo item, inserir
        await this.insertItem(remoteItem, store.id);
      } else {
        // Item existente, verificar atualizações
        const hasChanges = this.detectChanges(localItem, remoteItem);

        if (hasChanges) {
          await this.updateItem(localItem, remoteItem);
        }
      }
    }

    // Marcar items deletados
    const remoteIds = remoteItems.results.map(i => i.id);
    await db.prepare(`
      UPDATE items
      SET deleted = 1, deleted_at = ?
      WHERE store_id = ? AND ml_id NOT IN (${remoteIds.map(() => '?').join(',')})
    `).run(new Date().toISOString(), store.id, ...remoteIds);
  }

  async syncOrders(store, mlApi) {
    const lastOrderSync = this.lastSync[`orders_${store.id}`] ||
                         new Date(Date.now() - 86400000).toISOString(); // 24h atrás

    const orders = await mlApi.getOrders(store.ml_user_id, {
      date_from: lastOrderSync,
      limit: 100
    });

    for (const order of orders.results) {
      await this.upsertOrder(order, store.id);

      // Atualizar itens vendidos
      for (const item of order.order_items) {
        await this.updateItemSales(item.item.id, item.quantity);
      }
    }

    this.lastSync[`orders_${store.id}`] = new Date().toISOString();
  }

  async syncMetrics(store, mlApi) {
    const items = await db.prepare(`
      SELECT ml_id FROM items
      WHERE store_id = ? AND deleted = 0
    `).all(store.id);

    // Buscar visitas em lote
    const itemIds = items.map(i => i.ml_id);
    const visits = await mlApi.getItemVisits(itemIds);

    for (const visitData of visits) {
      await db.prepare(`
        UPDATE items
        SET visits = ?, last_visit_update = ?
        WHERE ml_id = ?
      `).run(
        visitData.total_visits,
        new Date().toISOString(),
        visitData.item_id
      );
    }

    // Calcular e armazenar métricas agregadas
    await this.calculateAggregateMetrics(store.id);
  }

  async calculateAggregateMetrics(storeId) {
    const metrics = await db.prepare(`
      SELECT
        COUNT(DISTINCT i.id) as total_items,
        COUNT(DISTINCT CASE WHEN i.status = 'active' THEN i.id END) as active_items,
        SUM(i.available_quantity) as total_stock,
        AVG(i.price) as avg_price,
        SUM(i.sold_quantity) as total_sold,
        AVG(i.visits) as avg_visits,
        COUNT(DISTINCT o.id) as total_orders,
        SUM(o.total_amount) as total_revenue
      FROM items i
      LEFT JOIN orders o ON o.store_id = i.store_id
      WHERE i.store_id = ? AND i.deleted = 0
    `).get(storeId);

    await db.prepare(`
      INSERT OR REPLACE INTO store_metrics (
        store_id, metrics, calculated_at
      ) VALUES (?, ?, ?)
    `).run(
      storeId,
      JSON.stringify(metrics),
      new Date().toISOString()
    );

    // Emitir métricas atualizadas
    io.to(`store:${storeId}`).emit('metrics_updated', metrics);
  }

  async handleConflict(localData, remoteData) {
    const resolution = await this.conflictResolver.resolve(localData, remoteData);

    switch(resolution.action) {
      case 'use_remote':
        await this.applyRemoteChanges(localData.id, remoteData);
        break;

      case 'use_local':
        await this.pushLocalChanges(localData.id, remoteData.id);
        break;

      case 'merge':
        const merged = resolution.mergedData;
        await this.applyMergedData(localData.id, merged);
        break;

      case 'manual':
        await this.createConflictReport(localData, remoteData);
        break;
    }

    // Registrar resolução
    await db.prepare(`
      INSERT INTO sync_conflicts (
        entity_type, entity_id, local_data,
        remote_data, resolution, resolved_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      resolution.entityType,
      localData.id,
      JSON.stringify(localData),
      JSON.stringify(remoteData),
      resolution.action,
      new Date().toISOString()
    );
  }

  async incrementalSync() {
    const stores = await db.prepare(`
      SELECT * FROM stores
      WHERE last_sync < datetime('now', '-5 minutes')
    `).all();

    for (const store of stores) {
      try {
        await this.syncStore(store);

        await db.prepare(`
          UPDATE stores
          SET last_sync = ?
          WHERE id = ?
        `).run(new Date().toISOString(), store.id);

      } catch (error) {
        console.error(`Erro ao sincronizar store ${store.id}:`, error);

        await db.prepare(`
          INSERT INTO sync_errors (
            store_id, error, timestamp
          ) VALUES (?, ?, ?)
        `).run(store.id, error.message, new Date().toISOString());
      }
    }
  }

  // Backup incremental
  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `backup_${timestamp}.db`;

    // Copiar banco atual
    await fs.copyFile('data.db', `backups/${backupFile}`);

    // Registrar backup
    await db.prepare(`
      INSERT INTO backups (
        filename, size, created_at
      ) VALUES (?, ?, ?)
    `).run(
      backupFile,
      (await fs.stat(`backups/${backupFile}`)).size,
      new Date().toISOString()
    );

    // Limpar backups antigos (manter últimos 30)
    const oldBackups = await db.prepare(`
      SELECT filename FROM backups
      ORDER BY created_at DESC
      LIMIT -1 OFFSET 30
    `).all();

    for (const backup of oldBackups) {
      await fs.unlink(`backups/${backup.filename}`);
      await db.prepare(`
        DELETE FROM backups WHERE filename = ?
      `).run(backup.filename);
    }
  }
}

// Iniciar sincronizador
const synchronizer = new DataSynchronizer();
synchronizer.startSync();

// Backup diário
setInterval(() => synchronizer.createBackup(), 86400000); // 24 horas

module.exports = DataSynchronizer;
```

---

## RESUMO DA IMPLEMENTAÇÃO COMPLETA

Esta implementação detalhada fornece:

### 1. **Novos Endpoints** (Backend)
- Sistema completo de reviews e avaliações
- Análise de tendências e insights de mercado
- Gestão de reclamações e mediações
- Sistema de promoções e campanhas

### 2. **Dashboard Melhorado** (Frontend)
- Gráficos interativos de tendências
- Análise competitiva em tempo real
- Sistema de alertas de oportunidades
- Análise preditiva com IA

### 3. **Automatizações Inteligentes** (MCP)
- Resposta automática a perguntas com IA
- Ajuste dinâmico de preços
- Republicação inteligente
- Gestão automatizada de estoque

### 4. **Integração MCP Remoto**
- Conexão com servidor oficial do ML
- Testes automatizados de ferramentas
- Orquestração híbrida local/remoto

### 5. **Webhooks em Tempo Real**
- Processamento instantâneo de eventos
- Sincronização automática de dados
- Sistema de backup incremental

Cada componente foi projetado para trabalhar em conjunto, criando um sistema robusto e escalável para gestão completa do Mercado Livre.