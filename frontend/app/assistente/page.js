'use client';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '../layout';
import api from '@/lib/api';

export default function AssistentePage() {
  const { activeStore } = useApp();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '👋 Olá! Sou o assistente IA do ML Gestão. Posso analisar seus anúncios, sugerir melhorias e executar ações.\n\nExemplos de perguntas:\n• "Quais anúncios estão fracos?"\n• "Analise o anúncio MLB123456"\n• "Resuma minhas vendas dos últimos 30 dias"\n• "Sugira melhorias para o anúncio MLB789"'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim() || loading || !activeStore) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const { tool, params } = parseUserIntent(userMessage, activeStore);
      
      if (tool) {
        const result = await api.executeMcpTool(tool, params);
        const formatted = formatToolResult(tool, result.result);
        setMessages(prev => [...prev, { role: 'assistant', content: formatted }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '🤔 Não entendi bem. Tente perguntas como:\n• "Quais anúncios estão fracos?"\n• "Analise o anúncio MLB123"\n• "Resuma minhas vendas"\n• "Sugira melhorias para MLB456"'
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Erro: ${err.message}`
      }]);
    }
    setLoading(false);
  }

  if (!activeStore) {
    return <div className="empty-state"><div className="icon">🤖</div><h3>Conecte uma loja primeiro</h3></div>;
  }

  return (
    <>
      <div className="page-header">
        <h2>🤖 Assistente IA</h2>
        <p>Pergunte sobre seus anúncios, vendas e performance</p>
      </div>

      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`chat-message ${msg.role}`}>
              <div className="chat-avatar">
                {msg.role === 'assistant' ? '🤖' : '👤'}
              </div>
              <div className="chat-bubble">
                {msg.content.split('\n').map((line, j) => (
                  <span key={j}>{line}<br /></span>
                ))}
              </div>
            </div>
          ))}
          {loading && (
            <div className="chat-message assistant">
              <div className="chat-avatar">🤖</div>
              <div className="chat-bubble">
                <div className="spinner" style={{ width: 18, height: 18 }}></div>
                <span style={{ marginLeft: 8 }}>Analisando...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input-area" onSubmit={handleSend}>
          <input
            className="form-input"
            placeholder="Pergunte sobre seus anúncios..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            Enviar
          </button>
        </form>
      </div>
    </>
  );
}

// Parseia a intenção do usuário para mapear a ferramenta MCP
function parseUserIntent(text, storeId) {
  const lower = text.toLowerCase();

  // Extrair ID de anúncio se mencionado
  const itemIdMatch = text.match(/MLB\d+/i);
  const itemId = itemIdMatch ? itemIdMatch[0].toUpperCase() : null;

  if (lower.includes('fraco') || lower.includes('problema') || lower.includes('baixa performance') || lower.includes('sem venda')) {
    return { tool: 'listar_anuncios_fracos', params: { storeId } };
  }
  if ((lower.includes('analise') || lower.includes('analis') || lower.includes('detalhe')) && itemId) {
    return { tool: 'analisar_anuncio', params: { storeId, itemId } };
  }
  if ((lower.includes('sugest') || lower.includes('melhor') || lower.includes('otimiz')) && itemId) {
    return { tool: 'sugerir_melhorias', params: { storeId, itemId } };
  }
  if (lower.includes('venda') || lower.includes('faturamento') || lower.includes('resumo')) {
    const diasMatch = text.match(/(\d+)\s*dias?/);
    const dias = diasMatch ? parseInt(diasMatch[1]) : 30;
    return { tool: 'resumo_vendas', params: { storeId, dias } };
  }
  if (lower.includes('paus') && itemId) {
    return { tool: 'pausar_anuncio', params: { storeId, itemId } };
  }
  if ((lower.includes('ativ') || lower.includes('reativ')) && itemId) {
    return { tool: 'reativar_anuncio', params: { storeId, itemId } };
  }
  if (lower.includes('repub') && itemId) {
    return { tool: 'republicar_anuncio', params: { storeId, itemId } };
  }

  return { tool: null, params: null };
}

// Formata o resultado da ferramenta para exibição no chat
function formatToolResult(tool, result) {
  switch (tool) {
    case 'listar_anuncios_fracos': {
      if (!result.items?.length) return '✅ Nenhum anúncio com problema encontrado!';
      let msg = `📊 ${result.message}\n\n`;
      result.items.forEach((item, i) => {
        msg += `${i + 1}. **${item.title}**\n`;
        msg += `   💰 R$ ${item.price} | 👁️ ${item.visitas} visitas | 🛒 ${item.vendas} vendas\n`;
        msg += `   ⚠️ Problemas: ${item.problemas.join(', ')}\n\n`;
      });
      return msg;
    }
    case 'analisar_anuncio': {
      return `📦 **${result.titulo}**\n` +
        `💰 ${result.preco}\n` +
        `📦 Estoque: ${result.estoque} | 🛒 Vendidos: ${result.vendidos}\n` +
        `👁️ Visitas: ${result.visitas} | 📈 Conversão: ${result.conversao}\n` +
        `📅 ${result.dias_ativo} dias ativo | 📸 ${result.fotos} fotos\n` +
        `🏷️ Tipo: ${result.tipo_listagem} | Status: ${result.status}`;
    }
    case 'sugerir_melhorias': {
      let msg = `📋 Sugestões para **${result.anuncio.titulo}**:\n\n`;
      result.sugestoes.forEach(s => { msg += `${s}\n\n`; });
      return msg;
    }
    case 'resumo_vendas': {
      return `📊 **${result.periodo}**\n` +
        `🛒 Total de vendas: ${result.total_vendas}\n` +
        `💰 Faturamento: R$ ${result.faturamento?.toFixed(2)}\n` +
        `📋 Por status: ${JSON.stringify(result.por_status)}`;
    }
    case 'pausar_anuncio':
    case 'reativar_anuncio':
    case 'republicar_anuncio': {
      return `✅ ${result.message}`;
    }
    default:
      return JSON.stringify(result, null, 2);
  }
}
