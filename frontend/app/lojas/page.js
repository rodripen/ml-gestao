'use client';
import { useState, useEffect } from 'react';
import { useApp } from '../layout';
import api from '@/lib/api';

export default function LojasPage() {
  const { stores, activeStore, setActiveStore, user } = useApp();
  const [localStores, setLocalStores] = useState(stores);
  const [connecting, setConnecting] = useState(false);

  // Checa se voltou do callback OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      // Recarrega lojas
      api.getStores().then(data => {
        setLocalStores(data.stores || []);
        const newStore = params.get('store');
        if (newStore) setActiveStore(newStore);
      });
      // Limpa URL
      window.history.replaceState({}, '', '/lojas');
    }
    if (params.get('error')) {
      alert('Erro na conexão: ' + params.get('error'));
      window.history.replaceState({}, '', '/lojas');
    }
  }, []);

  async function handleConnect() {
    setConnecting(true);
    try {
      const data = await api.connectML();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err) {
      alert('Erro: ' + err.message);
    }
    setConnecting(false);
  }

  async function handleDisconnect(storeId) {
    if (!confirm('Tem certeza que quer desconectar esta loja?')) return;
    try {
      await api.disconnectStore(storeId);
      setLocalStores(prev => prev.filter(s => s.id !== storeId));
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>Lojas</h2>
        <p>Gerencie suas contas do Mercado Livre conectadas</p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <button className="btn btn-primary" onClick={handleConnect} disabled={connecting}>
          {connecting ? '⏳ Redirecionando...' : '➕ Conectar Nova Loja'}
        </button>
      </div>

      {localStores.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🏪</div>
          <h3>Nenhuma loja conectada</h3>
          <p>Clique em "Conectar Nova Loja" para vincular sua conta do Mercado Livre</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {localStores.map(store => (
            <div key={store.id} className="card">
              <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--ml-yellow), var(--ml-blue))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22
                  }}>
                    🛒
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{store.ml_nickname || 'Loja ML'}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {store.ml_email || store.ml_user_id}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      ID: {store.ml_user_id}
                    </div>
                  </div>
                </div>

                <div className="btn-group">
                  {activeStore === store.id ? (
                    <span className="badge badge-success">● Ativa</span>
                  ) : (
                    <button className="btn btn-secondary btn-sm" onClick={() => setActiveStore(store.id)}>
                      Selecionar
                    </button>
                  )}
                  <button className="btn btn-danger btn-sm" onClick={() => handleDisconnect(store.id)}>
                    Desconectar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: 32 }}>
        <div className="card-header"><h3>ℹ️ Como funciona</h3></div>
        <div className="card-body" style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.8 }}>
          <p>1. Clique em <strong>"Conectar Nova Loja"</strong> — você será redirecionado para o Mercado Livre</p>
          <p>2. Faça login e <strong>autorize o acesso</strong> à sua conta</p>
          <p>3. Pronto! A loja aparece aqui e seus anúncios/vendas ficam disponíveis no painel</p>
          <p style={{ marginTop: 12 }}>Você pode conectar <strong>múltiplas lojas</strong> e alternar entre elas pelo seletor na barra lateral.</p>
        </div>
      </div>
    </>
  );
}
