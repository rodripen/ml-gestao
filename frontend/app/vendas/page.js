'use client';
import { useState, useEffect } from 'react';
import { useApp } from '../layout';
import api from '@/lib/api';

export default function VendasPage() {
  const { activeStore } = useApp();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!activeStore) return;
    setLoading(true);
    api.getOrders(activeStore).then(data => {
      setOrders(data.orders || []);
      setTotal(data.total || 0);
    }).catch(err => {
      console.error('Erro ao carregar pedidos:', err);
    }).finally(() => setLoading(false));
  }, [activeStore]);

  if (!activeStore) {
    return <div className="empty-state"><div className="icon">🏪</div><h3>Selecione uma loja</h3></div>;
  }

  function getStatusBadge(status) {
    switch (status) {
      case 'paid': return <span className="badge badge-success">✅ Pago</span>;
      case 'confirmed': return <span className="badge badge-info">📋 Confirmado</span>;
      case 'cancelled': return <span className="badge badge-danger">❌ Cancelado</span>;
      default: return <span className="badge badge-warning">{status}</span>;
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  return (
    <>
      <div className="page-header">
        <h2>Vendas</h2>
        <p>Pedidos recentes — {total} no total</p>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"></div>Carregando vendas...</div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <div className="icon">💰</div>
          <h3>Nenhuma venda encontrada</h3>
        </div>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Produto</th>
                <th>Comprador</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>#{order.id}</td>
                  <td>
                    {order.items?.map(item => (
                      <div key={item.id}>
                        <span style={{ fontWeight: 500 }}>{item.title}</span>
                        <br />
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          Qtd: {item.quantity} × R$ {item.unit_price?.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </td>
                  <td>{order.buyer?.nickname || '—'}</td>
                  <td style={{ fontWeight: 700, color: 'var(--ml-yellow)' }}>
                    R$ {order.total_amount?.toFixed(2)}
                  </td>
                  <td>{getStatusBadge(order.status)}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {formatDate(order.date_created)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
