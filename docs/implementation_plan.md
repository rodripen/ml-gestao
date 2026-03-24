# Plataforma de Gestão Mercado Livre — Assistente + Painel + Agente

Sistema completo para gerenciar anúncios e vendas do Mercado Livre, combinando a **API oficial do ML** com um **servidor MCP** para automação inteligente com IA.

## Decisões de Arquitetura

> **IMPORTANTE — Antes de começar a implementação:**
> 1. Você já tem um **App ID** e **Secret** do Mercado Livre? (Criado em https://developers.mercadolivre.com.br/detalhe-da-aplicacao)
> 2. Qual a **redirect URI** que vamos usar? (ex: `http://localhost:3001/api/auth/callback`)
> 3. Quer usar o **MCP remoto do ML** (`https://mcp.mercadolibre.com/mcp`) ou montar um **MCP local** que chama seu backend?
> 4. Vai ser para **uso pessoal** ou pretende virar **SaaS** (multi-seller)?

---

## Arquitetura Geral

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                     │
│  Dashboard │ Anúncios │ Vendas │ Chat IA (Assistente)    │
└────────────────────────┬────────────────────────────────┘
                         │ REST API
┌────────────────────────▼────────────────────────────────┐
│                   Backend (Node.js/Express)              │
│  Auth OAuth2 │ Items │ Orders │ Metrics │ MCP Tools      │
└──────┬───────────────────────────────────┬──────────────┘
       │                               │
┌──────▼──────┐              ┌─────────▼──────────┐
│  SQLite DB  │              │  API Mercado Livre  │
│  (histórico)│              │  api.mercadolibre   │
└─────────────┘              └────────────────────┘
```

---

## Componente 1 — Backend (Node.js + Express)

### Estrutura de pastas

```
backend/
├── package.json
├── server.js                 # Entry point
├── .env.example              # Variáveis de ambiente
├── config/
│   └── database.js           # Setup SQLite
├── middleware/
│   └── auth.js               # Middleware de autenticação
├── routes/
│   ├── auth.js               # OAuth2 login/callback/refresh
│   ├── items.js              # CRUD anúncios
│   ├── orders.js             # Vendas e pedidos
│   └── metrics.js            # Métricas e performance
├── services/
│   ├── mercadolivre.js       # Client HTTP para API ML
│   ├── tokenManager.js       # Gestão de tokens
│   ├── itemsService.js       # Lógica de anúncios
│   ├── ordersService.js      # Lógica de vendas
│   └── metricsService.js     # Cálculos de performance
├── mcp/
│   └── tools.js              # Ferramentas MCP expostas
└── db/
    └── schema.sql            # Schema do SQLite
```

### Arquivos

- **server.js** — Express server na porta 3001, CORS, rotas `/api/auth`, `/api/items`, `/api/orders`, `/api/metrics`
- **services/mercadolivre.js** — Classe `MercadoLivreAPI`:
  - `getItems(sellerId)` → `GET /users/{id}/items/search`
  - `getItem(itemId)` → `GET /items/{id}`
  - `createItem(data)` → `POST /items`
  - `updateItem(itemId, data)` → `PUT /items/{id}`
  - `changeStatus(itemId, status)` → `PUT /items/{id}` com `{ status }`
  - `getOrders(sellerId)` → `GET /orders/search?seller={id}`
  - `getVisits(itemId)` → `GET /visits/items?ids={id}`
  - `getUserInfo(userId)` → `GET /users/{id}` (reputação)
- **services/tokenManager.js** — Armazena tokens em SQLite, auto-refresh (6h)
- **routes/auth.js** — OAuth2: login, callback, status, refresh
- **routes/items.js** — CRUD anúncios + pausar/ativar/duplicar
- **routes/orders.js** — Lista vendas e detalhes de pedidos
- **routes/metrics.js** — Dashboard, anúncios fracos, reputação
- **db/schema.sql** — Tabelas: `tokens`, `items_history`, `orders_history`, `metrics_snapshots`

---

## Componente 2 — Frontend (Next.js)

### Estrutura

```
frontend/
├── package.json
├── next.config.js
├── app/
│   ├── layout.js
│   ├── page.js              # Dashboard
│   ├── globals.css          # Design system
│   ├── anuncios/
│   │   └── page.js          # Lista de anúncios
│   ├── vendas/
│   │   └── page.js          # Lista de vendas
│   └── assistente/
│       └── page.js          # Chat IA
├── components/
│   ├── Sidebar.js
│   ├── StatsCard.js
│   ├── ItemCard.js
│   ├── OrderCard.js
│   └── ChatAssistant.js
└── lib/
    └── api.js               # Client HTTP para backend
```

### Páginas

- **Dashboard** — Cards (vendas, faturamento, ativos, reputação), gráfico 30 dias, anúncios com problema
- **Anúncios** — Tabela com filtros (sem venda, CTR baixo, estoque baixo), ações rápidas (editar preço, pausar, duplicar)
- **Vendas** — Pedidos recentes com item, comprador, valor, status, envio
- **Assistente** — Chat com IA via MCP, perguntas em linguagem natural

---

## Componente 3 — Servidor MCP (Ferramentas para IA)

Ferramentas de alto nível:
- `listar_anuncios_fracos` — Retorna anúncios com pouca venda/visita
- `analisar_anuncio` — Métricas detalhadas de um anúncio
- `sugerir_melhorias` — Sugere título, preço, descrição
- `alterar_preco` — Muda preço de um anúncio
- `pausar_anuncio` / `reativar_anuncio`
- `republicar_anuncio` — Fecha e cria cópia
- `resumo_vendas` — Resumo das vendas do período
- `cadastrar_produto` — Cria anúncio a partir de dados

---

## Endpoints da API ML utilizados

| Funcionalidade | Endpoint | Método |
|---|---|---|
| OAuth - Autorizar | `https://auth.mercadolivre.com.br/authorization` | GET |
| OAuth - Token | `https://api.mercadolibre.com/oauth/token` | POST |
| Listar items do seller | `/users/{user_id}/items/search` | GET |
| Detalhes do item | `/items/{item_id}` | GET |
| Múltiplos items | `/items?ids=X,Y,Z` | GET |
| Criar item | `/items` | POST |
| Editar item | `/items/{item_id}` | PUT |
| Descrição do item | `/items/{item_id}/description` | GET |
| Visitas do item | `/visits/items?ids={item_id}` | GET |
| Pedidos do seller | `/orders/search?seller={seller_id}` | GET |
| Detalhes do pedido | `/orders/{order_id}` | GET |
| Info do usuário (reputação) | `/users/{user_id}` | GET |
| Preditor de categoria | `/sites/MLB/domain_discovery/search?q={title}` | GET |

---

## Verificação

1. **Fluxo OAuth**: Abrir `/api/auth/login` e verificar redirecionamento para ML
2. **API Items**: Após auth, acessar `/api/items` e verificar JSON com anúncios
3. **Dashboard visual**: Abrir `http://localhost:3000` e verificar cards e gráficos
4. **Assistente IA**: Fazer perguntas no chat e verificar respostas com dados reais
