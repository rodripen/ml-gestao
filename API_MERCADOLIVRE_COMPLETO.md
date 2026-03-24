# API DO MERCADO LIVRE - DOCUMENTAÇÃO COMPLETA

## STATUS DA INTEGRAÇÃO ATUAL

### ✅ MCP Local Implementado
O sistema **NÃO** está usando o MCP remoto do ML (`https://mcp.mercadolibre.com/mcp`), mas sim um **MCP local** implementado em `backend/mcp/tools.js` com as seguintes ferramentas:

#### Ferramentas de Análise:
- `listar_anuncios_fracos` - Identifica anúncios com problemas de performance
- `analisar_anuncio` - Análise detalhada de métricas de um anúncio
- `sugerir_melhorias` - Sugere otimizações para anúncios

#### Ferramentas de Ação:
- `alterar_preco` - Modifica preço de anúncio
- `pausar_anuncio` / `reativar_anuncio` - Gerenciar status
- `republicar_anuncio` - Fecha e duplica anúncio
- `resumo_vendas` - Relatório de vendas do período
- `cadastrar_produto` - Criar novo anúncio

### 📊 Endpoints Já Implementados no Backend

O arquivo `backend/services/mercadolivre.js` já implementa:

1. **Autenticação OAuth2**
   - Login, callback, refresh token

2. **Gestão de Anúncios**
   - Listar, criar, editar, duplicar
   - Pausar, ativar, alterar status
   - Buscar descrições

3. **Pedidos/Vendas**
   - Listar pedidos do vendedor
   - Detalhes de pedidos

4. **Métricas**
   - Visitas de anúncios
   - Séries temporais de visitas
   - Informações de usuário/reputação

5. **Categorias**
   - Predição de categoria
   - Atributos de categoria

---

## 🌐 TODOS OS DADOS DISPONÍVEIS NA API DO MERCADO LIVRE

### 1. USUÁRIOS E CONTAS
```
GET /users/{user_id}
GET /users/me
GET /users/{user_id}/accepted_payment_methods
GET /users/{user_id}/seller_reputation
```

**Dados que podemos obter:**
- Nome, apelido, email
- Endereço, telefone
- Status da conta, data de criação
- Reputação (vendas, reclamações, cancelamentos)
- Nível do vendedor (MercadoLíder, etc.)
- Métodos de pagamento aceitos
- Configurações de envio

### 2. ANÚNCIOS/ITEMS
```
GET /items/{item_id}
GET /items?ids=id1,id2,id3
GET /users/{user_id}/items/search
POST /items
PUT /items/{item_id}
```

**Dados disponíveis:**
- **Informações básicas**: ID, título, preço, moeda
- **Estoque**: quantidade disponível, vendidos
- **Categoria**: categoria_id, atributos
- **Mídia**: fotos (até 10), vídeos
- **Condição**: novo, usado, recondicionado
- **Tipo de listagem**: gratuito, clássico, premium
- **Status**: active, paused, closed, under_review
- **Envio**: frete grátis, métodos disponíveis
- **Localização**: cidade, estado, CEP
- **Garantia**: tipo, tempo
- **Variações**: cor, tamanho, etc.
- **SKU**: código interno do vendedor
- **Identificadores**: EAN, UPC, ISBN
- **Datas**: criação, última modificação
- **Health/Qualidade**: score de qualidade do anúncio

### 3. VISITAS E MÉTRICAS
```
GET /visits/items?ids={item_id}
GET /visits/items/time_series
GET /items/{item_id}/visits/time_window
```

**Métricas disponíveis:**
- **Visitas totais**: contador acumulado
- **Visitas por período**: dia, semana, mês
- **Taxa de conversão**: calculada (vendas/visitas)
- **CTR (Click-Through Rate)**: quando em promoções
- **Origem das visitas**: busca, direct, ads
- **Dispositivos**: mobile, desktop
- **Localização**: por estado/cidade

### 4. PEDIDOS E VENDAS
```
GET /orders/{order_id}
GET /orders/search?seller={seller_id}
GET /orders/{order_id}/shipments
GET /orders/{order_id}/feedback
```

**Informações de pedidos:**
- **Identificação**: order_id, pack_id
- **Comprador**: nickname (anonimizado), dados de contato
- **Itens**: produtos, quantidades, variações
- **Valores**: preço unitário, total, frete, taxas
- **Pagamento**: método, status, parcelas
- **Status**: confirmed, payment_required, paid, delivered
- **Envio**: código rastreamento, transportadora, prazo
- **Feedback**: nota, comentários
- **Mensagens**: histórico de comunicação
- **Notas fiscais**: quando disponível
- **Datas**: compra, pagamento, envio, entrega

### 5. PERGUNTAS E RESPOSTAS
```
GET /questions/search?item={item_id}
GET /questions/search?seller={seller_id}
POST /answers
```

**Dados de perguntas:**
- Texto da pergunta
- Data e hora
- Status (respondida/pendente)
- ID do item relacionado
- Resposta do vendedor
- Perguntas bloqueadas/deletadas

### 6. CATEGORIAS E ATRIBUTOS
```
GET /categories/{category_id}
GET /categories/{category_id}/attributes
GET /sites/MLB/categories
GET /sites/MLB/domain_discovery/search
```

**Informações disponíveis:**
- Hierarquia completa de categorias
- Atributos obrigatórios e opcionais
- Valores permitidos para cada atributo
- Regras de publicação
- Taxas e comissões por categoria
- Predição automática de categoria

### 7. REPUTAÇÃO E QUALIDADE
```
GET /users/{user_id}/seller_reputation
GET /seller_reputation/level/{seller_id}
GET /items/{item_id}/health
```

**Métricas de reputação:**
- **Vendas**: últimos 60 dias, 3 meses, 1 ano
- **Reclamações**: quantidade e taxa
- **Cancelamentos**: iniciados pelo vendedor
- **Atrasos no envio**: quantidade e percentual
- **Nível**: inicial, bronze, prata, ouro, platinum
- **Qualidade de atendimento**: tempo de resposta
- **Pontos positivos/negativos/neutros**

### 8. PROMOÇÕES E CAMPANHAS
```
GET /seller-promotions/promotions
GET /seller-promotions/candidates
POST /seller-promotions/items/{item_id}
GET /seller-promotions/promotions/{promotion_id}
```

**Tipos de promoções:**
- **Campanhas do ML**: Black Friday, Hot Sale, etc.
- **Campanhas próprias**: descontos do vendedor
- **Ofertas relâmpago**: tempo limitado
- **Cupons**: códigos de desconto
- **Desconto progressivo**: por quantidade
- **Combo/Kit**: múltiplos produtos
- **Frete grátis**: subsidiado

**Dados disponíveis:**
- Tipo e nome da promoção
- Percentual de desconto
- Período de vigência
- Itens participantes
- Performance (vendas, conversão)
- Investimento e retorno

### 9. ENVIOS E LOGÍSTICA
```
GET /shipments/{shipment_id}
GET /shipments/{shipment_id}/tracking
GET /sites/MLB/shipping/services
POST /shipments/{shipment_id}/label
```

**Informações de envio:**
- **Modalidades**: Mercado Envios, próprio, retirada
- **Status**: pending, handling, ready_to_ship, shipped, delivered
- **Rastreamento**: código, eventos, localização
- **Etiquetas**: geração e impressão
- **Custos**: valor do frete, quem paga
- **Prazos**: estimativa, SLA
- **Endereços**: origem, destino
- **Transportadoras**: disponíveis, selecionada

### 10. PAGAMENTOS (via Mercado Pago)
```
GET /collections/{payment_id}
GET /payments/search
```

**Dados de pagamento:**
- Método (cartão, boleto, pix, etc.)
- Status (pending, approved, rejected)
- Parcelas
- Taxas e tarifas
- Data de liberação do dinheiro
- Chargebacks e disputas

### 11. MENSAGENS PÓS-VENDA
```
GET /messages/packs/{pack_id}/messages
POST /messages/packs/{pack_id}/messages
GET /messages/attachments/{attachment_id}
```

**Sistema de mensagens:**
- Conversas entre comprador e vendedor
- Anexos (fotos, documentos)
- Notificações
- Templates automáticos
- Histórico completo

### 12. RECLAMAÇÕES E MEDIAÇÕES
```
GET /post-purchase/v1/claims/search
GET /post-purchase/v1/claims/{claim_id}
GET /post-purchase/v2/claims/{claim_id}/returns
```

**Gestão de problemas:**
- Tipos: não recebido, não conforme, defeito
- Status da mediação
- Histórico de mensagens
- Decisões do ML
- Devoluções
- Reembolsos

### 13. AVALIAÇÕES DE PRODUTOS
```
GET /reviews/item/{item_id}
GET /reviews/seller/{seller_id}
```

**Reviews disponíveis:**
- Nota (1-5 estrelas)
- Título e comentário
- Data da avaliação
- Resposta do vendedor
- Votos úteis
- Distribuição de notas

### 14. TENDÊNCIAS E INSIGHTS
```
GET /trends/MLB/{category_id}
GET /highlights/top/MLB
```

**Análises de mercado:**
- Produtos mais vendidos
- Tendências de busca
- Preço médio por categoria
- Sazonalidade
- Concorrência

### 15. NOTIFICAÇÕES E WEBHOOKS

**Tópicos disponíveis para webhooks:**
- `items` - Mudanças em anúncios
- `orders_v2` - Novas vendas e atualizações
- `questions` - Novas perguntas
- `messages` - Mensagens pós-venda
- `payments` - Status de pagamentos
- `shipments` - Atualizações de envio
- `claims` - Reclamações e mediações
- `invoices` - Notas fiscais

---

## 🚀 COMO INTEGRAR O MCP REMOTO DO ML

O MCP remoto do Mercado Livre (`https://mcp.mercadolibre.com/mcp`) oferece ferramentas prontas para IA. Para integrar:

### 1. Configuração no Claude Desktop
```json
{
  "mcpServers": {
    "mercadolibre": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-mercadolibre"
      ],
      "env": {
        "MERCADOLIBRE_APP_ID": "seu_app_id",
        "MERCADOLIBRE_SECRET": "seu_secret",
        "MERCADOLIBRE_REDIRECT_URI": "http://localhost:3001/callback"
      }
    }
  }
}
```

### 2. Ferramentas disponíveis no MCP remoto:
- Busca de produtos
- Gestão de anúncios
- Análise de métricas
- Respostas a perguntas
- Gestão de pedidos

---

## 📈 LIMITES E CONSIDERAÇÕES

### Rate Limits
- **1.500 requisições/minuto** por vendedor
- HTTP 429 quando excedido
- Implementar retry com backoff

### Limites de Dados
- Máximo 50-100 items por request
- Paginação obrigatória para listas grandes
- Histórico limitado (geralmente 6 meses)

### Tokens
- Access token: válido por 6 horas
- Refresh token: válido por 6 meses
- Renovação automática necessária

### Privacidade
- Dados de compradores são anonimizados
- CPF/CNPJ protegidos
- Endereços completos só após venda

---

## 🎯 PRÓXIMOS PASSOS RECOMENDADOS

1. **Implementar mais endpoints no backend:**
   - Reviews e avaliações
   - Tendências e insights
   - Reclamações e mediações
   - Promoções e campanhas

2. **Melhorar o Dashboard:**
   - Gráficos de tendências
   - Comparativo com concorrência
   - Alertas de oportunidades
   - Análise preditiva

3. **Automatizações via MCP:**
   - Resposta automática a perguntas
   - Ajuste dinâmico de preços
   - Republicação inteligente
   - Gestão de estoque

4. **Integração com MCP remoto do ML:**
   - Configurar credenciais
   - Testar ferramentas nativas
   - Combinar com MCP local

5. **Webhooks:**
   - Implementar endpoint para receber notificações
   - Processar eventos em tempo real
   - Atualizar dados locais automaticamente

---

Esta documentação fornece uma visão completa de todos os dados que podem ser consumidos da API do Mercado Livre e o status atual da integração no seu sistema.