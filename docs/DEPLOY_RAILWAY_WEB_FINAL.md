# 🚀 DEPLOY NO RAILWAY - GUIA VISUAL DEFINITIVO

## ✅ PRÉ-REQUISITOS COMPLETOS

Você JÁ TEM tudo pronto:
- ✅ Repositório Git inicializado e commitado
- ✅ Arquivos de configuração criados (railway.json, nixpacks.toml)
- ✅ Docker configurado
- ✅ PostgreSQL schema pronto

---

## 📋 PASSO A PASSO (5 MINUTOS)

### **PASSO 1: Criar Conta GitHub e Enviar Código** (2 min)

```bash
# 1. Crie uma conta no GitHub se não tiver: https://github.com/signup

# 2. Crie um novo repositório:
# - Acesse: https://github.com/new
# - Nome: ml-gestao
# - Visibilidade: Private (recomendado)
# - NÃO marque "Add README"
# - Clique em "Create repository"

# 3. No terminal, execute:
git remote add origin https://github.com/SEU_USUARIO/ml-gestao.git
git branch -M main
git push -u origin main
```

⚠️ **IMPORTANTE**: Substitua `SEU_USUARIO` pelo seu usuário do GitHub

---

### **PASSO 2: Acessar Railway** (30 seg)

1. Acesse: **https://railway.app/**
2. Clique em **"Start a New Project"**
3. Faça login com **GitHub** (botão "Login with GitHub")
4. Autorize o Railway a acessar seus repositórios

---

### **PASSO 3: Deploy do Backend + PostgreSQL** (2 min)

#### 3.1 - Criar Projeto
1. No Railway, clique em **"New Project"**
2. Selecione **"Deploy from GitHub repo"**
3. Escolha o repositório **`ml-gestao`**
4. Railway vai detectar automaticamente que é um projeto Node.js

#### 3.2 - Adicionar PostgreSQL
1. No mesmo projeto, clique em **"+ New"**
2. Selecione **"Database"**
3. Escolha **"Add PostgreSQL"**
4. Aguarde ~30 segundos (provisionamento automático)

#### 3.3 - Configurar Variáveis do Backend
1. Clique no serviço **`ml-gestao`**
2. Vá em **"Variables"**
3. Clique em **"+ New Variable"** e adicione:

```env
# Banco de dados (auto-preenchido pelo Railway)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Mercado Livre (OBTENHA EM: https://developers.mercadolivre.com.br/apps)
ML_APP_ID=SEU_APP_ID_AQUI
ML_SECRET=SEU_SECRET_AQUI

# URLs (Railway preenche automaticamente)
ML_REDIRECT_URI=${{RAILWAY_PUBLIC_DOMAIN}}/api/auth/ml/callback

# Porta
PORT=3001

# Ambiente
NODE_ENV=production
```

4. Clique em **"Deploy"** (canto superior direito)

---

### **PASSO 4: Deploy do Frontend** (1 min)

#### 4.1 - Adicionar Serviço do Frontend
1. No mesmo projeto, clique em **"+ New"**
2. Selecione **"GitHub Repo"**
3. Escolha o mesmo repositório **`ml-gestao`**
4. Em **"Root Directory"**, digite: `frontend`

#### 4.2 - Configurar Variáveis do Frontend
1. Clique no novo serviço (frontend)
2. Vá em **"Variables"**
3. Adicione:

```env
# Backend URL (pega do serviço backend)
NEXT_PUBLIC_API_URL=${{ml-gestao.RAILWAY_PUBLIC_DOMAIN}}

# Porta
PORT=3000
```

4. Clique em **"Deploy"**

---

### **PASSO 5: Obter as URLs** (30 seg)

1. **Backend**:
   - Clique no serviço `ml-gestao`
   - Vá em **"Settings"** → **"Domains"**
   - Copie a URL: `https://ml-gestao-production.up.railway.app`

2. **Frontend**:
   - Clique no serviço frontend
   - Vá em **"Settings"** → **"Domains"**
   - Copie a URL: `https://ml-gestao-frontend.up.railway.app`

---

## 🔑 OBTENDO CREDENCIAIS DO MERCADO LIVRE

### Passo 1: Criar App no ML
1. Acesse: **https://developers.mercadolivre.com.br/**
2. Faça login com sua conta do Mercado Livre
3. Vá em **"Minhas aplicações"** → **"Criar nova aplicação"**
4. Preencha:
   - **Nome**: ML Gestão
   - **Descrição curta**: Sistema de gestão de anúncios
   - **URL de redirecionamento**: `https://SEU-BACKEND.up.railway.app/api/auth/ml/callback`
   - **Notificações**: Deixe em branco por enquanto

5. Clique em **"Criar aplicação"**

### Passo 2: Copiar Credenciais
Você verá:
- **App ID**: `1234567890123456`
- **Secret Key**: `AbCdEfGh1234567890`

### Passo 3: Atualizar Railway
1. Volte para o Railway
2. Vá no serviço backend → **Variables**
3. Atualize:
   - `ML_APP_ID` = cole o App ID
   - `ML_SECRET` = cole o Secret Key
4. O serviço vai **redeploy automaticamente**

---

## 🎯 VERIFICAR SE FUNCIONOU

### Backend (API):
```bash
# Teste básico
curl https://SEU-BACKEND.up.railway.app/health

# Deve retornar:
{"status":"ok","timestamp":"2026-03-24T..."}
```

### Frontend (Dashboard):
```bash
# Abra no navegador:
https://SEU-FRONTEND.up.railway.app

# Você deve ver a página inicial com:
# - Logo do ML Gestão
# - Botão "Conectar Loja"
```

### PostgreSQL:
O Railway já conectou automaticamente! ✅

---

## 🚨 PROBLEMAS COMUNS E SOLUÇÕES

### ❌ "Application failed to respond"
**Causa**: Variáveis de ambiente faltando
**Solução**:
1. Verifique se `DATABASE_URL` está configurada
2. Verifique se `PORT` está definida
3. Vá em "Deployments" e veja os logs

### ❌ "Database connection refused"
**Causa**: PostgreSQL não inicializado
**Solução**:
1. Verifique se o serviço PostgreSQL está "Active" (verde)
2. Vá em backend → Variables
3. Confirme que `DATABASE_URL` aponta para `${{Postgres.DATABASE_URL}}`

### ❌ "ML_APP_ID is required"
**Causa**: Credenciais do ML não configuradas
**Solução**:
1. Obtenha credenciais em https://developers.mercadolivre.com.br
2. Adicione em Variables
3. Redeploy vai acontecer automaticamente

### ❌ Frontend não conecta no Backend
**Causa**: `NEXT_PUBLIC_API_URL` incorreta
**Solução**:
1. Frontend → Variables
2. Atualize para a URL pública do backend
3. Deve começar com `https://`

---

## 📊 MONITORAMENTO

### Ver Logs em Tempo Real:
1. Clique em qualquer serviço
2. Vá em **"Deployments"**
3. Clique no deployment ativo
4. Veja a aba **"Logs"**

### Métricas:
- **CPU Usage**: Grátis até 512MB RAM
- **Bandwidth**: 100GB/mês grátis
- **Database**: 512MB storage grátis

### Custo:
- **Plano Gratuito**: $5/mês de crédito
- **Estimativa de uso**:
  - Backend: ~$5/mês
  - Frontend: ~$5/mês
  - PostgreSQL: ~$5/mês
  - **Total**: ~$15/mês (ou gratuito se usar pouco)

---

## 🔄 ATUALIZAÇÕES FUTURAS

Sempre que você alterar o código:

```bash
# 1. Commit as mudanças
git add .
git commit -m "Descrição da mudança"

# 2. Push para GitHub
git push

# 3. Railway detecta e faz deploy automático! 🎉
```

Você pode acompanhar o deploy em tempo real no painel do Railway.

---

## 🎉 PRÓXIMOS PASSOS APÓS DEPLOY

### 1. Testar OAuth com ML:
```
1. Acesse: https://SEU-FRONTEND.up.railway.app
2. Clique em "Conectar Loja"
3. Faça login no Mercado Livre
4. Autorize o app
5. Você será redirecionado de volta ✅
```

### 2. Verificar Dados:
```bash
# Conecte no PostgreSQL do Railway
railway connect Postgres

# Verifique se as tabelas foram criadas
\dt

# Deve mostrar:
# - users
# - stores
# - items
# - orders
# - qa_history
# etc...
```

### 3. Configurar Webhooks do ML:
```
1. Vá em https://developers.mercadolivre.com.br
2. Selecione seu app
3. Configure webhook URL:
   https://SEU-BACKEND.up.railway.app/api/webhooks/ml
4. Marque eventos: orders, questions, claims
```

---

## 📞 SUPORTE

### Railway:
- Docs: https://docs.railway.app
- Discord: https://discord.gg/railway
- Status: https://status.railway.app

### Mercado Livre:
- Docs: https://developers.mercadolivre.com.br
- Fórum: https://developers.mercadolivre.com.br/forum

---

## ✅ CHECKLIST FINAL

Antes de considerar o deploy completo, verifique:

- [ ] Backend respondendo em `/health`
- [ ] Frontend acessível no navegador
- [ ] PostgreSQL conectado (sem erros nos logs)
- [ ] Variáveis `ML_APP_ID` e `ML_SECRET` configuradas
- [ ] OAuth do ML funcionando (consegue conectar loja)
- [ ] Logs sem erros críticos
- [ ] URLs públicas anotadas

---

## 🚀 VOCÊ ESTÁ PRONTO!

Seu sistema está agora **rodando em produção** com:
- ✅ Backend Node.js escalável
- ✅ Frontend Next.js otimizado
- ✅ PostgreSQL gerenciado
- ✅ SSL/HTTPS automático
- ✅ Deploy contínuo configurado

**Próximo passo**: Implementar as funcionalidades de vendas (resposta automática, republicação, etc.)!

---

**Dúvidas?** Todos os arquivos de configuração já estão prontos no seu projeto! 🎉
