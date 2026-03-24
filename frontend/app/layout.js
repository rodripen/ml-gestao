'use client';
import './globals.css';
import { useState, useEffect, createContext, useContext } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/lib/api';

export const AppContext = createContext();

export function useApp() {
  return useContext(AppContext);
}

function Sidebar({ stores, activeStore, setActiveStore, pathname }) {
  const links = [
    { href: '/', icon: '📊', label: 'Dashboard' },
    { href: '/anuncios', icon: '📦', label: 'Anúncios' },
    { href: '/vendas', icon: '💰', label: 'Vendas' },
    { href: '/assistente', icon: '🤖', label: 'Assistente IA' },
    { href: '/lojas', icon: '🏪', label: 'Lojas' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">🛒</div>
        <h1>ML Gestão</h1>
      </div>

      <nav className="sidebar-nav">
        {links.map(link => (
          <a
            key={link.href}
            href={link.href}
            className={`nav-link ${pathname === link.href ? 'active' : ''}`}
          >
            <span className="icon">{link.icon}</span>
            {link.label}
          </a>
        ))}
      </nav>

      <div className="sidebar-footer">
        {stores.length > 0 ? (
          <select
            className="store-select"
            value={activeStore || ''}
            onChange={(e) => setActiveStore(e.target.value)}
          >
            {stores.map(s => (
              <option key={s.id} value={s.id}>
                🟢 {s.ml_nickname || s.ml_email}
              </option>
            ))}
          </select>
        ) : (
          <a href="/lojas" className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
            + Conectar Loja
          </a>
        )}
      </div>
    </aside>
  );
}

function AuthGate({ children }) {
  const [user, setUser] = useState(null);
  const [stores, setStores] = useState([]);
  const [activeStore, setActiveStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [formData, setFormData] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const pathname = usePathname();

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api.getMe()
        .then(data => {
          setUser(data.user);
          setStores(data.stores || []);
          if (data.stores?.length > 0) {
            setActiveStore(data.stores[0].id);
          }
        })
        .catch(() => { api.clearToken(); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    try {
      let data;
      if (authMode === 'register') {
        data = await api.register(formData.email, formData.password, formData.name);
      } else {
        data = await api.login(formData.email, formData.password);
      }
      setUser(data.user);
      const storesData = await api.getStores();
      setStores(storesData.stores || []);
      if (storesData.stores?.length > 0) setActiveStore(storesData.stores[0].id);
    } catch (err) {
      setError(err.message);
    }
  };

  const logout = () => {
    api.logout();
    setUser(null);
    setStores([]);
    setActiveStore(null);
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div>Carregando...</div>;
  }

  if (!user) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <div className="logo">
            <h1>🛒 ML Gestão</h1>
            <p>{authMode === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}</p>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form className="auth-form" onSubmit={handleAuth}>
            {authMode === 'register' && (
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input className="form-input" type="text" placeholder="Seu nome"
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="seu@email.com"
                value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Senha</label>
              <input className="form-input" type="password" placeholder="••••••••"
                value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            </div>
            <button type="submit" className="btn btn-primary">
              {authMode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>

          <div className="auth-switch">
            {authMode === 'login' ? (
              <>Não tem conta? <a onClick={() => setAuthMode('register')}>Cadastre-se</a></>
            ) : (
              <>Já tem conta? <a onClick={() => setAuthMode('login')}>Fazer login</a></>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ user, stores, activeStore, setActiveStore, logout }}>
      <div className="app-layout">
        <Sidebar stores={stores} activeStore={activeStore} setActiveStore={setActiveStore} pathname={pathname} />
        <main className="main-content">
          {children}
        </main>
      </div>
    </AppContext.Provider>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <title>ML Gestão — Painel de Gestão Mercado Livre</title>
        <meta name="description" content="Gerencie seus anúncios e vendas do Mercado Livre com inteligência" />
      </head>
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
