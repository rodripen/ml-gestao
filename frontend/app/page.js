'use client';
import { useState, useEffect } from 'react';
import { useApp } from './layout';
import api from '@/lib/api';

export default function Dashboard() {
  const { activeStore, stores } = useApp();
  const [dashboard, setDashboard] = useState(null);
  const [weakItems, setWeakItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeStore) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      api.getDashboard(activeStore).catch(() => null),
      api.getWeakItems(activeStore).catch(() => ({ weakItems: [] }))
    ]).then(([dash, weak]) => {
      setDashboard(dash);
      setWeakItems(weak?.weakItems || []);
    }).finally(() => setLoading(false));
  }, [activeStore]);

  if (!activeStore) {
    return (
      <div className="empty-state">
        <div className="icon">🏪</div>
        <h3>Conecte sua primeira loja</h3>
        <p>Vá em <strong>Lojas</strong> para conectar sua conta do Mercado Livre</p>
        <a href="/lojas" className="btn btn-primary" style={{ marginTop: 16 }}>Conectar Loja</a>
      </div>
    );
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div>Carregando dashboard...</div>;
  }

  const rep = dashboard?.reputation || {};
  const totals = dashboard?.totals || {};

  return (
    <>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Visão geral da sua loja — {dashboard?.seller?.nickname}</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-label">Anúncios Ativos</div>
          <div className="stat-value">{totals.active_items || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🛒</div>
          <div className="stat-label">Vendas Totais</div>
          <div className="stat-value">{totals.total_sales || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⭐</div>
          <div className="stat-label">Reputação</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{rep.level || '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🏆</div>
          <div className="stat-label">MercadoLíder</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{rep.power_seller || 'Não'}</div>
        </div>
      </div>

      <div className="two-cols">
        <div className="card">
          <div className="card-header">
            <h3>📈 Métricas de Reputação</h3>
          </div>
          <div className="card-body">
            <table className="data-table">
              <tbody>
                <tr>
                  <td>Reclamações</td>
                  <td><span className={`badge ${rep.claims_rate > 0.02 ? 'badge-danger' : 'badge-success'}`}>
                    {((rep.claims_rate || 0) * 100).toFixed(1)}%
                  </span></td>
                </tr>
                <tr>
                  <td>Cancelamentos</td>
                  <td><span className={`badge ${rep.cancellations_rate > 0.02 ? 'badge-danger' : 'badge-success'}`}>
                    {((rep.cancellations_rate || 0) * 100).toFixed(1)}%
                  </span></td>
                </tr>
                <tr>
                  <td>Atrasos no envio</td>
                  <td><span className={`badge ${rep.delayed_rate > 0.05 ? 'badge-warning' : 'badge-success'}`}>
                    {((rep.delayed_rate || 0) * 100).toFixed(1)}%
                  </span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>⚠️ Anúncios com Problema ({weakItems.length})</h3>
            <a href="/anuncios" className="btn btn-secondary btn-sm">Ver todos</a>
          </div>
          <div className="card-body">
            {weakItems.length === 0 ? (
              <div className="empty-state" style={{ padding: 20 }}>
                <p>🎉 Nenhum anúncio com problema!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {weakItems.slice(0, 5).map(item => (
                  <div key={item.id} className="item-card" style={{ padding: 14 }}>
                    <div className="item-info">
                      <div className="item-title">{item.title}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {item.reasons.map(r => (
                          <span key={r} className={`badge ${r.includes('estoque') ? 'badge-warning' : 'badge-danger'}`}>
                            {r.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="item-price">R$ {item.price}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
