/**
 * Ferramentas MCP para o agente IA
 * Estas funções são expostas como "tools" que a IA pode chamar
 * via linguagem natural para analisar e agir nos anúncios.
 */

const tokenManager = require('../services/tokenManager');
const analytics = require('../services/analytics');

const mcpTools = {
  // ═══════════════════════════════════════════════════════════
  // ANÁLISE (usa camada de serviços compartilhada)
  // ═══════════════════════════════════════════════════════════

  async listar_anuncios_fracos({ storeId, minDays = 7, maxVisits = 50, maxSales = 0 }) {
    const result = await analytics.getWeakItems(storeId, { minDays, maxVisits, maxSales });

    return {
      message: `Encontrados ${result.total} anúncios com problemas de ${result.totalActive} ativos.`,
      items: result.items.map(item => ({
        id: item.id,
        title: item.title,
        price: item.price,
        estoque: item.available_quantity,
        vendas: item.sold_quantity,
        visitas: item.visits,
        conversao: `${item.conversion_rate.toFixed(1)}%`,
        dias_ativo: item.days_active,
        problemas: item.reasons.map(r => r.toUpperCase().replace('_', ' ')),
        link: item.permalink
      }))
    };
  },

  async analisar_anuncio({ storeId, itemId }) {
    const a = await analytics.analyzeItem(storeId, itemId);
    const conv = a.visits > 0 ? ((a.sold_quantity) / a.visits * 100) : 0;

    return {
      id: a.id,
      titulo: a.title,
      preco: `${a.currency_id} ${a.price}`,
      estoque: a.available_quantity,
      vendidos: a.sold_quantity,
      visitas: a.visits,
      conversao: `${conv.toFixed(1)}%`,
      dias_ativo: a.days_active,
      status: a.status,
      fotos: a.photos,
      tipo_listagem: a.listing_type,
      condicao: a.condition,
      descricao_tamanho: a.description_length,
      link: a.permalink
    };
  },

  async sugerir_melhorias({ storeId, itemId }) {
    const result = await analytics.suggestImprovements(storeId, itemId);
    const a = result.analysis;
    const conv = a.visits > 0 ? ((a.sold_quantity) / a.visits * 100) : 0;

    return {
      anuncio: {
        id: a.id,
        titulo: a.title,
        preco: `${a.currency_id} ${a.price}`,
        estoque: a.available_quantity,
        vendidos: a.sold_quantity,
        visitas: a.visits,
        conversao: `${conv.toFixed(1)}%`,
        dias_ativo: a.days_active,
        fotos: a.photos,
        tipo_listagem: a.listing_type,
        descricao_tamanho: a.description_length
      },
      sugestoes: result.suggestions
    };
  },

  // ═══════════════════════════════════════════════════════════
  // AÇÕES
  // ═══════════════════════════════════════════════════════════

  async alterar_preco({ storeId, itemId, novoPreco }) {
    const mlApi = await tokenManager.getApiClient(storeId);
    await mlApi.updateItem(itemId, { price: novoPreco });
    return { message: `Preço alterado para ${novoPreco}`, item_id: itemId };
  },

  async pausar_anuncio({ storeId, itemId }) {
    const mlApi = await tokenManager.getApiClient(storeId);
    await mlApi.changeItemStatus(itemId, 'paused');
    return { message: `Anúncio ${itemId} pausado com sucesso.` };
  },

  async reativar_anuncio({ storeId, itemId }) {
    const mlApi = await tokenManager.getApiClient(storeId);
    await mlApi.changeItemStatus(itemId, 'active');
    return { message: `Anúncio ${itemId} reativado com sucesso.` };
  },

  async republicar_anuncio({ storeId, itemId }) {
    const mlApi = await tokenManager.getApiClient(storeId);
    await mlApi.changeItemStatus(itemId, 'closed');
    const newItem = await mlApi.duplicateItem(itemId);
    return {
      message: `Anúncio republicado! Original ${itemId} fechado, novo: ${newItem.id}`,
      novo_id: newItem.id,
      link: newItem.permalink
    };
  },

  async resumo_vendas({ storeId, dias = 30 }) {
    const result = await analytics.getSalesSummary(storeId, dias);
    return {
      periodo: result.period,
      total_vendas: result.total_sales,
      total_pedidos_na_api: result.total_orders_api,
      faturamento: result.revenue,
      por_status: result.by_status
    };
  },

  async cadastrar_produto({ storeId, titulo, preco, estoque, categoria, descricao, fotos = [] }) {
    const mlApi = await tokenManager.getApiClient(storeId);

    let categoryId = categoria;
    if (!categoryId && titulo) {
      try {
        const prediction = await mlApi.predictCategory(titulo);
        if (prediction && prediction[0]) {
          categoryId = prediction[0].category_id;
        }
      } catch (e) {
        console.warn('Aviso: não foi possível predizer categoria:', e.message);
      }
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
