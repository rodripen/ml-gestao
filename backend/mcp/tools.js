/**
 * Ferramentas MCP para o agente IA
 * Estas funções são expostas como "tools" que a IA pode chamar
 * via linguagem natural para analisar e agir nos anúncios.
 */

const tokenManager = require('../services/tokenManager');
const { getDb } = require('../config/database');

const mcpTools = {
  // ═══════════════════════════════════════════════════════════
  // ANÁLISE
  // ═══════════════════════════════════════════════════════════

  /**
   * Lista anúncios com baixa performance
   * Parâmetros: storeId, minDays (default 7), maxVisits (default 50)
   */
  async listar_anuncios_fracos({ storeId, minDays = 7, maxVisits = 50, maxSales = 0 }) {
    const mlApi = await tokenManager.getApiClient(storeId);
    const db = getDb();
    const store = db.prepare('SELECT ml_user_id FROM stores WHERE id = ?').get(storeId);

    const search = await mlApi.getSellerItems(store.ml_user_id, { status: 'active', limit: 50 });
    if (!search.results || search.results.length === 0) {
      return { message: 'Nenhum anúncio ativo encontrado.', items: [] };
    }

    const items = await mlApi.getMultipleItems(search.results);
    let visitsMap = {};
    try {
      const visitsData = await mlApi.getItemVisits(search.results);
      if (Array.isArray(visitsData)) {
        visitsData.forEach(v => { visitsMap[v.item_id] = v.total_visits || 0; });
      }
    } catch (e) {}

    const now = new Date();
    const weakItems = items
      .map(item => {
        const b = item.body;
        if (!b) return null;
        const daysActive = Math.floor((now - new Date(b.date_created)) / 86400000);
        const visits = visitsMap[b.id] || 0;
        const conv = visits > 0 ? ((b.sold_quantity || 0) / visits * 100) : 0;

        const problems = [];
        if (daysActive >= minDays && (b.sold_quantity || 0) <= maxSales) problems.push('SEM VENDAS');
        if (daysActive >= minDays && visits <= maxVisits) problems.push('POUCAS VISITAS');
        if (conv < 1 && visits > 50) problems.push('CONVERSÃO BAIXA');
        if (b.available_quantity <= 2 && b.available_quantity > 0) problems.push('ESTOQUE BAIXO');
        if (b.available_quantity === 0) problems.push('SEM ESTOQUE');

        if (problems.length === 0) return null;
        return {
          id: b.id, title: b.title, price: b.price,
          estoque: b.available_quantity, vendas: b.sold_quantity || 0,
          visitas: visits, conversao: `${conv.toFixed(1)}%`,
          dias_ativo: daysActive, problemas: problems,
          link: b.permalink
        };
      })
      .filter(Boolean);

    return {
      message: `Encontrados ${weakItems.length} anúncios com problemas de ${search.paging?.total || 0} ativos.`,
      items: weakItems
    };
  },

  /**
   * Analisa um anúncio específico em detalhes
   */
  async analisar_anuncio({ storeId, itemId }) {
    const mlApi = await tokenManager.getApiClient(storeId);
    const item = await mlApi.getItem(itemId);

    let visits = 0;
    try {
      const v = await mlApi.getItemVisits(itemId);
      if (Array.isArray(v) && v[0]) visits = v[0].total_visits;
    } catch (e) {}

    let description = '';
    try {
      const desc = await mlApi.getItemDescription(itemId);
      description = desc.plain_text || '';
    } catch (e) {}

    const conv = visits > 0 ? ((item.sold_quantity || 0) / visits * 100) : 0;
    const daysActive = Math.floor((new Date() - new Date(item.date_created)) / 86400000);

    return {
      id: item.id,
      titulo: item.title,
      preco: `${item.currency_id} ${item.price}`,
      estoque: item.available_quantity,
      vendidos: item.sold_quantity || 0,
      visitas: visits,
      conversao: `${conv.toFixed(1)}%`,
      dias_ativo: daysActive,
      status: item.status,
      fotos: (item.pictures || []).length,
      tipo_listagem: item.listing_type_id,
      condicao: item.condition,
      descricao_tamanho: description.length,
      link: item.permalink
    };
  },

  /**
   * Sugere melhorias para um anúncio
   */
  async sugerir_melhorias({ storeId, itemId }) {
    const analise = await mcpTools.analisar_anuncio({ storeId, itemId });
    const sugestoes = [];

    if (analise.visitas < 50 && analise.dias_ativo > 7) {
      sugestoes.push('📝 TÍTULO: Melhore o título com palavras-chave mais buscadas. Use termos específicos do produto.');
    }
    if (analise.fotos < 5) {
      sugestoes.push(`📸 FOTOS: Adicione mais fotos (tem ${analise.fotos}, ideal é 6+). ` +
        'Fotos de qualidade aumentam a conversão.');
    }
    if (analise.descricao_tamanho < 200) {
      sugestoes.push('📋 DESCRIÇÃO: A descrição está curta. Detalhe especificações, benefícios e diferenciais.');
    }
    if (analise.conversao.replace('%', '') < 1 && analise.visitas > 100) {
      sugestoes.push('💰 PREÇO: A conversão está baixa. Considere ajustar o preço ou criar promoção.');
    }
    if (analise.tipo_listagem === 'free') {
      sugestoes.push('⭐ TIPO DE ANÚNCIO: Você está no tipo gratuito. Considere usar Clássico ou Premium para mais visibilidade.');
    }
    if (analise.estoque <= 2) {
      sugestoes.push('📦 ESTOQUE: Estoque muito baixo. Aumente para não perder vendas.');
    }

    if (sugestoes.length === 0) {
      sugestoes.push('✅ O anúncio está com boa performance! Continue monitorando.');
    }

    return { anuncio: analise, sugestoes };
  },

  // ═══════════════════════════════════════════════════════════
  // AÇÕES
  // ═══════════════════════════════════════════════════════════

  /**
   * Altera o preço de um anúncio
   */
  async alterar_preco({ storeId, itemId, novoPreco }) {
    const mlApi = await tokenManager.getApiClient(storeId);
    const result = await mlApi.updateItem(itemId, { price: novoPreco });
    return { message: `Preço alterado para ${novoPreco}`, item_id: itemId };
  },

  /**
   * Pausa um anúncio
   */
  async pausar_anuncio({ storeId, itemId }) {
    const mlApi = await tokenManager.getApiClient(storeId);
    await mlApi.changeItemStatus(itemId, 'paused');
    return { message: `Anúncio ${itemId} pausado com sucesso.` };
  },

  /**
   * Reativa um anúncio pausado
   */
  async reativar_anuncio({ storeId, itemId }) {
    const mlApi = await tokenManager.getApiClient(storeId);
    await mlApi.changeItemStatus(itemId, 'active');
    return { message: `Anúncio ${itemId} reativado com sucesso.` };
  },

  /**
   * Republica um anúncio (fecha e cria cópia)
   */
  async republicar_anuncio({ storeId, itemId }) {
    const mlApi = await tokenManager.getApiClient(storeId);
    // Fecha o original
    await mlApi.changeItemStatus(itemId, 'closed');
    // Duplica
    const newItem = await mlApi.duplicateItem(itemId);
    return {
      message: `Anúncio republicado! Original ${itemId} fechado, novo: ${newItem.id}`,
      novo_id: newItem.id,
      link: newItem.permalink
    };
  },

  /**
   * Resumo de vendas do período
   */
  async resumo_vendas({ storeId, dias = 30 }) {
    const mlApi = await tokenManager.getApiClient(storeId);
    const db = getDb();
    const store = db.prepare('SELECT ml_user_id FROM stores WHERE id = ?').get(storeId);

    const dateFrom = new Date(Date.now() - dias * 86400000).toISOString();
    const orders = await mlApi.getOrders(store.ml_user_id, {
      dateFrom,
      limit: 50
    });

    const results = orders.results || [];
    const totalVendas = results.length;
    const totalFaturamento = results.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const statusCount = {};
    results.forEach(o => {
      statusCount[o.status] = (statusCount[o.status] || 0) + 1;
    });

    return {
      periodo: `Últimos ${dias} dias`,
      total_vendas: totalVendas,
      total_pedidos_na_api: orders.paging?.total || totalVendas,
      faturamento: totalFaturamento,
      por_status: statusCount
    };
  },

  /**
   * Cadastra um novo produto
   */
  async cadastrar_produto({ storeId, titulo, preco, estoque, categoria, descricao, fotos = [] }) {
    const mlApi = await tokenManager.getApiClient(storeId);

    // Se não informou categoria, tenta predizer
    let categoryId = categoria;
    if (!categoryId && titulo) {
      try {
        const prediction = await mlApi.predictCategory(titulo);
        if (prediction && prediction[0]) {
          categoryId = prediction[0].category_id;
        }
      } catch (e) {}
    }

    const itemData = {
      title: titulo,
      price: preco,
      available_quantity: estoque || 1,
      category_id: categoryId,
      currency_id: 'BRL',
      buying_mode: 'buy_it_now',
      condition: 'new',
      listing_type_id: 'gold_special',
      pictures: fotos.map(url => ({ source: url }))
    };

    if (descricao) {
      itemData.description = { plain_text: descricao };
    }

    const newItem = await mlApi.createItem(itemData);
    return {
      message: `Produto cadastrado com sucesso!`,
      id: newItem.id,
      link: newItem.permalink
    };
  }
};

module.exports = mcpTools;
