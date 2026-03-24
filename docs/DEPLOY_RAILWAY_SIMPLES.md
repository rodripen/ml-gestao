# 🚂 DEPLOY NO RAILWAY - 5 MINUTOS!

## ✨ Por que Railway?
- **GRÁTIS** para começar ($5/mês inclusos)
- **5 minutos** para deploy completo
- **Zero configuração** de servidor
- **PostgreSQL incluído** automaticamente

---

## 📝 PASSO 1: CRIAR CONTA (1 min)

1. Acesse: https://railway.app/
2. Clique **"Start a New Project"**
3. Login com **GitHub** (mais fácil)

---

## 🚀 PASSO 2: DEPLOY DO PROJETO (3 min)

### Opção A: Deploy Direto (MAIS FÁCIL)

1. No Railway, clique **"New Project"**
2. Escolha **"Deploy from GitHub repo"**
3. Conecte seu GitHub se necessário
4. Selecione o repositório `ml-gestao`
5. Railway vai detectar automaticamente:
   - Node.js (backend)
   - Next.js (frontend)
   - PostgreSQL necessário

### Opção B: Usando Railway CLI

```bash
# Instalar CLI
npm install -g @railway/cli

# Login
railway login

# Inicializar projeto
railway init

# Deploy
railway up
```

---

## ⚙️ PASSO 3: CONFIGURAR VARIÁVEIS (1 min)

No Railway Dashboard:

1. Clique no seu projeto
2. Vá em **"Variables"**
3. Adicione estas variáveis:

```env
# Banco (Railway cria automaticamente!)
DATABASE_URL=(já preenchido pelo Railway)

# Mercado Livre
ML_APP_ID=seu_app_id_aqui
ML_SECRET=seu_secret_aqui
ML_REDIRECT_URI=https://seu-app.up.railway.app/api/auth/ml/callback

# Segurança
JWT_SECRET=gere_uma_chave_32_caracteres_aqui
SESSION_SECRET=outra_chave_diferente_aqui

# URLs
FRONTEND_URL=https://seu-app.up.railway.app
NEXT_PUBLIC_API_URL=https://seu-app.up.railway.app/api

# Features
ENABLE_AUTO_RESPONSE=true
ENABLE_AUTO_REPUBLISH=true
ENABLE_CLAUDE_AI=true
```

---

## 🗄️ PASSO 4: CONFIGURAR POSTGRESQL (Automático!)

Railway cria automaticamente, mas precisamos rodar as migrações:

1. No Railway, clique no serviço do backend
2. Vá em **"Settings"** → **"Deploy"**
3. Em **"Start Command"**, adicione:

```bash
npm run db:migrate && npm start
```

Ou adicione um arquivo `railway.json` no projeto:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run db:migrate && npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

## 🌐 PASSO 5: DOMÍNIO CUSTOMIZADO (Opcional)

### Domínio Railway Grátis:
Você já tem: `https://seu-app.up.railway.app`

### Domínio Próprio:
1. Vá em **Settings** → **Domains**
2. Adicione seu domínio
3. Configure DNS:
   ```
   CNAME  www  seu-app.up.railway.app
   ```

---

## ✅ PRONTO! SEU APP ESTÁ NO AR!

### URLs do seu sistema:
- Frontend: `https://seu-app.up.railway.app`
- Backend API: `https://seu-app.up.railway.app/api`
- Health Check: `https://seu-app.up.railway.app/api/health`

---

## 📊 MONITORAMENTO

No Railway Dashboard você tem:

- **Logs** em tempo real
- **Métricas** (CPU, RAM, Network)
- **Deploys** histórico
- **Custos** em tempo real
- **Alertas** automáticos

---

## 💰 CUSTOS

### Plano Hobby ($5/mês inclusos):
- **$5 de crédito** todo mês
- **8GB RAM** máximo
- **Múltiplos serviços** (backend + frontend + DB)

### Estimativa para seu projeto:
```
Backend:     ~$2/mês
Frontend:    ~$2/mês
PostgreSQL:  ~$1/mês
Total:       ~$5/mês (COBERTO PELO CRÉDITO!)
```

### Quando vai começar a pagar:
- Até ~1000 usuários: **GRÁTIS** (dentro dos $5)
- 1000-5000 usuários: ~$10-20/mês
- 5000+ usuários: ~$50+/mês

---

## 🚄 COMANDOS ÚTEIS

### Ver logs:
```bash
railway logs
```

### Variáveis de ambiente:
```bash
railway variables
```

### Executar comandos no container:
```bash
railway run npm run db:migrate
railway run node scripts/seed.js
```

### Rollback:
```bash
# No dashboard, clique em qualquer deploy anterior
# Clique em "Rollback to this deployment"
```

---

## 🔧 CONFIGURAÇÕES EXTRAS

### 1. Adicionar no `package.json` do backend:

```json
{
  "scripts": {
    "start": "node server.js",
    "db:migrate": "node database/migrate.js",
    "postinstall": "npm run db:migrate"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### 2. Criar `railway.toml` na raiz:

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm run start"
healthcheckPath = "/health"
healthcheckTimeout = 300

[[services]]
name = "backend"
startCommand = "cd backend && npm start"

[[services]]
name = "frontend"
startCommand = "cd frontend && npm run start"
```

---

## 🎯 TROUBLESHOOTING

### Erro: "Build failed"
```bash
# Verificar package.json tem script "build"
# Verificar versão do Node
"engines": {
  "node": ">=18.0.0"
}
```

### Erro: "Database connection failed"
```bash
# DATABASE_URL é configurado automaticamente
# Verificar se migration rodou
railway run npm run db:migrate
```

### Erro: "Port not configured"
```javascript
// backend/server.js
const PORT = process.env.PORT || 3001;
```

---

## 🎉 VANTAGENS DO RAILWAY

1. **PR Environments**: Cada PR tem ambiente próprio!
2. **Rollback instantâneo**: Voltar versão com 1 clique
3. **Auto-scaling**: Escala automaticamente
4. **Sleeping**: Economiza quando não tem tráfego
5. **Templates**: Reusar configurações

---

## 🆚 COMPARAÇÃO COM OUTRAS OPÇÕES

| | Railway | Vercel | Heroku | Render |
|---|---|---|---|---|
| **Preço** | $5/mês | $20/mês | $5/mês | $7/mês |
| **PostgreSQL** | ✅ Incluído | ❌ | $9/mês extra | ✅ 90 dias |
| **Setup** | 5 min | 15 min | 20 min | 10 min |
| **DX** | Excelente | Ótimo | OK | Bom |
| **Suporte** | Discord ativo | Pago | Pago | Email |

---

## 🚀 PRÓXIMOS PASSOS

1. ✅ Deploy feito
2. ⏭️ Testar autenticação com Mercado Livre
3. ⏭️ Configurar webhooks do ML
4. ⏭️ Adicionar monitoramento (Sentry)
5. ⏭️ Configurar backup automático

---

## 📱 APLICATIVO MOBILE (Futuro)

Quando quiser app mobile:
- API já está pronta em `https://seu-app.up.railway.app/api`
- Basta criar app React Native/Flutter apontando para essa URL

---

## 💡 DICAS PRO

1. **Use Preview Environments**:
   - Cada branch tem seu ambiente
   - Teste antes de fazer merge

2. **Configure Sleeping**:
   - Economiza créditos quando sem tráfego
   - Settings → Sleeping → Enable

3. **Use Railway CLI**:
   - Mais rápido para debug
   - `railway logs -f` para logs em tempo real

4. **Monitore custos**:
   - Dashboard → Usage
   - Configure alertas

---

## ✨ RESUMO

Com Railway você tem:
- ✅ Deploy em 5 minutos
- ✅ $5/mês grátis (suficiente para começar)
- ✅ Zero configuração de servidor
- ✅ PostgreSQL incluído
- ✅ SSL automático
- ✅ Logs e métricas
- ✅ Rollback fácil
- ✅ Suporte ativo no Discord

**É a escolha perfeita para colocar seu projeto em produção HOJE!**

---

## 🆘 AJUDA

- Railway Discord: https://discord.gg/railway
- Railway Docs: https://docs.railway.app/
- Status: https://status.railway.app/

**Vamos fazer o deploy? É literalmente 5 minutos!** 🚀