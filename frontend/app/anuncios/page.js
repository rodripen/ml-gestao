'use client';
import { useState, useEffect } from 'react';
import { useApp } from '../layout';
import api from '@/lib/api';

export default function AnunciosPage() {
  const { activeStore } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    if (!activeStore) return;
    loadItems();
  }, [activeStore, filter]);

  async function loadItems() {
    setLoading(true);
    try {
      const params = {};
      if (filter !== 'all') params.status = filter;
      const data = await api.getItems(activeStore, params);
      setItems(data.items || []);
    } catch (err) {
      console.error('Erro ao carregar items:', err);
    }
    setLoading(false);
  }

  async function handleStatusChange(itemId, status) {
    setActionLoading(itemId);
    try {
      await api.changeItemStatus(activeStore, itemId, status);
      await loadItems();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
    setActionLoading(null);
  }

  async function handleDuplicate(itemId) {
    setActionLoading(itemId);
    try {
      const result = await api.duplicateItem(activeStore, itemId);
      alert(`Anúncio duplicado! Novo ID: ${result.item?.id}`);
      await loadItems();
    } catch (err) {
      alert('Erro ao duplicar: ' + err.message);
    }
    setActionLoading(null);
  }

  if (!activeStore) {
    return <div className="empty-state"><div className="icon">🏪</div><h3>Selecione uma loja</h3></div>;
  }

  return (
    <>
      <div className="page-header">
        <h2>Anúncios</h2>
        <p>Gerencie todos os seus anúncios do Mercado Livre</p>
      </div>

      <div className="filters-bar">
        {[
          { key: 'all', label: '📋 Todos' },
          { key: 'active', label: '🟢 Ativos' },
          { key: 'paused', label: '⏸️ Pausados' },
          { key: 'closed', label: '🔴 Fechados' },
        ].map(f => (
          <button key={f.key} className={`filter-chip ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"></div>Carregando anúncios...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📦</div>
          <h3>Nenhum anúncio encontrado</h3>
          <p>Mude o filtro ou conecte uma loja com anúncios</p>
        </div>
      ) : (
        <div className="items-grid">
          {items.map(item => (
            <div key={item.id} className="item-card">
              {item.thumbnail && (
                <img src={item.thumbnail} alt="" className="item-thumb" />
              )}
              <div className="item-info">
                <div className="item-title">{item.title}</div>
                <div className="item-price">R$ {item.price?.toFixed(2)}</div>
                <div className="item-meta">
                  <span>📦 Estoque: {item.available_quantity || 0}</span>
                  <span>🛒 Vendidos: {item.sold_quantity || 0}</span>
                  <span>👁️ Visitas: {item.visits || 0}</span>
                  <span className={`badge ${
                    item.status === 'active' ? 'badge-success' :
                    item.status === 'paused' ? 'badge-warning' : 'badge-danger'
                  }`}>
                    {item.status === 'active' ? 'Ativo' :
                     item.status === 'paused' ? 'Pausado' : 'Fechado'}
                  </span>
                </div>
              </div>
              <div className="item-actions">
                {actionLoading === item.id ? (
                  <div className="spinner" style={{ width: 20, height: 20 }}></div>
                ) : (
                  <>
                    {item.status === 'active' && (
                      <button className="btn btn-warning btn-sm" onClick={() => handleStatusChange(item.id, 'paused')}>
                        ⏸️ Pausar
                      </button>
                    )}
                    {item.status === 'paused' && (
                      <button className="btn btn-primary btn-sm" onClick={() => handleStatusChange(item.id, 'active')}>
                        ▶️ Ativar
                      </button>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={() => handleDuplicate(item.id)}>
                      📋 Duplicar
                    </button>
                    <a href={item.permalink} target="_blank" rel="noopener" className="btn btn-secondary btn-sm">
                      🔗 Ver no ML
                    </a>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
