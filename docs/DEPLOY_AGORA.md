# 🚀 DEPLOY NO RAILWAY - AGORA!

## ✅ CÓDIGO JÁ ESTÁ NO GITHUB!

Seu repositório: **https://github.com/rodripen/ml-gestao**

---

## 🎯 PASSOS PARA FAZER O DEPLOY (3 MINUTOS)

### **PASSO 1: Acesse o Railway** (30 seg)

1. Abra no navegador: **https://railway.app/**
2. Clique em **"Login"**
3. Escolha **"Login with GitHub"**
4. Autorize o Railway

---

### **PASSO 2: Criar Projeto** (1 min)

1. Após o login, clique em **"New Project"**
2. Selecione **"Deploy from GitHub repo"**
3. Procure e selecione: **`rodripen/ml-gestao`**
4. Railway vai detectar automaticamente e começar o build

---

### **PASSO 3: Adicionar PostgreSQL** (30 seg)

1. No mesmo projeto, clique no botão **"+ New"** (canto superior direito)
2. Selecione **"Database"**
3. Escolha **"Add PostgreSQL"**
4. Aguarde ~30 segundos (ícone fica verde quando pronto)

---

### **PASSO 4: Configurar Variáveis do Backend** (1 min)

1. Clique no serviço **`ml-gestao`** (card do seu projeto)
2. Vá na aba **"Variables"**
3. Clique em **"+ New Variable"** e adicione TODAS estas variáveis:

```env
DATABASE_URL
```
**Valor**: Cole `${{Postgres.DATABASE_URL}}` (exatamente assim)

```env
ML_APP_ID
```
**Valor**: `CONFIGURAR_DEPOIS`

```env
ML_SECRET
```
**Valor**: `CONFIGURAR_DEPOIS`

```env
PORT
```
**Valor**: `3001`

```env
NODE_ENV
```
**Valor**: `production`

4. Clique em **"Deploy"** (ou aguarde deploy automático)

---

### **PASSO 5: Obter URL do Backend** (30 seg)

1. Ainda no serviço `ml-gestao`, vá em **"Settings"**
2. Role até **"Domains"**
3. Clique em **"Generate Domain"**
4. Copie a URL gerada (algo como: `https://ml-gestao-production.up.railway.app`)

---

### **PASSO 6: Deploy do Frontend** (1 min)

**IMPORTANTE**: O Railway só vai fazer deploy de um serviço por padrão. Para fazer deploy do frontend separadamente, você tem 2 opções:

#### **Opção A: Usar apenas o Backend (mais simples)**
O backend pode servir arquivos estáticos. Vamos configurar isso depois.

#### **Opção B: Deploy separado do Frontend**
1. No projeto, clique em **"+ New"**
2. Selecione **"GitHub Repo"**
3. Escolha novamente: **`rodripen/ml-gestao`**
4. Em **"Root Directory"**, digite: `frontend`
5. Vá em **"Variables"** e adicione:

```env
NEXT_PUBLIC_API_URL
```
**Valor**: Cole a URL do backend que você copiou no Passo 5

```env
PORT
```
**Valor**: `3000`

---

## 🎉 PRONTO! SEU SISTEMA ESTÁ NO AR!

### ✅ Verifique se funcionou:

1. **Backend**:
   - Acesse: `https://SUA-URL.up.railway.app/health`
   - Deve retornar: `{"status":"ok",...}`

2. **Logs**:
   - Clique no serviço → Aba **"Deployments"**
   - Veja se há erros

---

## 🔑 PRÓXIMO PASSO: CONFIGURAR MERCADO LIVRE

### 1. Criar App no Mercado Livre

1. Acesse: **https://developers.mercadolivre.com.br/**
2. Faça login
3. Vá em **"Minhas aplicações"** → **"Criar nova aplicação"**
4. Preencha:
   - **Nome**: ML Gestão
   - **Descrição**: Sistema de gestão
   - **URL de redirecionamento**: `https://SUA-URL-BACKEND.up.railway.app/api/auth/ml/callback`
5. Clique em **"Criar"**

### 2. Copiar Credenciais

Você verá:
- **App ID**: `1234567890123456`
- **Secret Key**: `AbCdEfGh1234567890`

### 3. Atualizar Railway

1. Volte para o Railway
2. Serviço backend → **Variables**
3. Edite:
   - `ML_APP_ID` = cole o App ID
   - `ML_SECRET` = cole o Secret
4. Adicione também:

```env
ML_REDIRECT_URI
```
**Valor**: `https://SUA-URL-BACKEND.up.railway.app/api/auth/ml/callback`

5. Railway vai fazer **redeploy automático**

---

## 🎯 RESUMO:

```
✅ Código no GitHub: https://github.com/rodripen/ml-gestao
✅ Repositório público e acessível
✅ Pronto para deploy no Railway

AGORA VOCÊ FAZ:
1. Railway.app → Login com GitHub
2. New Project → Deploy from GitHub
3. Adicionar PostgreSQL
4. Configurar variáveis
5. Obter credenciais do ML
6. SISTEMA NO AR! 🚀
```

---

## 🆘 PROBLEMAS?

### Backend não inicia:
- Verifique se `DATABASE_URL` está configurada
- Veja os logs em: Deployments → Logs

### Erro de conexão com banco:
- Certifique-se que PostgreSQL está "Active" (verde)
- `DATABASE_URL` deve ser: `${{Postgres.DATABASE_URL}}`

### Precisa de ajuda?
- Me avise e eu te ajudo a debugar!

---

**BORA FAZER O DEPLOY! Abra o https://railway.app/ agora! 🚀**
