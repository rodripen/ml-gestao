# ✅ VARIÁVEIS CORRETAS PARA O RAILWAY

## 🎯 VARIÁVEIS ESSENCIAIS (CONFIGURAR AGORA):

Remova TODAS as variáveis atuais e adicione APENAS estas:

### **1. DATABASE_URL**
```
${{Postgres.DATABASE_URL}}
```
**Importante**: Escreva exatamente assim, com cifrão e chaves duplas!

### **2. PORT**
```
3001
```

### **3. NODE_ENV**
```
production
```

### **4. ML_APP_ID**
```
CONFIGURAR_DEPOIS
```
(Você vai mudar isso depois quando criar o app no ML Developers)

### **5. ML_SECRET**
```
CONFIGURAR_DEPOIS
```
(Você vai mudar isso depois quando criar o app no ML Developers)

### **6. ML_REDIRECT_URI**
```
${{RAILWAY_PUBLIC_DOMAIN}}/api/auth/ml/callback
```
**Importante**: Sem `https://` no início! O Railway adiciona automaticamente.

---

## ❌ REMOVER ESTAS (NÃO PRECISA AGORA):

```
BACKEND_PORT
BACKEND_URL
COOLIFY_AUTO_SSL
COOLIFY_MANAGED
DB_HOST
DB_NAME
DB_PASSWORD
DB_PORT
DB_USER
DOMAIN
ENABLE_AUTO_REPUBLISH
ENABLE_AUTO_RESPONSE
ENABLE_CLAUDE_AI
ENABLE_METRICS
ENABLE_TITLE_VARIATIONS
FRONTEND_PORT
FRONTEND_URL
JWT_SECRET
LOG_LEVEL
MAX_AUTO_RESPONSES_PER_DAY
MAX_REPUBLICATIONS_PER_DAY
MAX_STORES_PER_USER
NEXT_PUBLIC_API_URL
REDIS_HOST
REDIS_PORT
REDIS_URL
SESSION_SECRET
```

Essas variáveis são para funcionalidades avançadas que vamos implementar depois.

---

## 📋 COMO FAZER NO RAILWAY:

### **Opção A: Limpar e Recriar (Mais Rápido)**

1. No Railway, vá no serviço `ml-gestao`
2. Aba **"Variables"**
3. Clique nos 3 pontinhos (...) ao lado de cada variável
4. Selecione **"Remove"** em TODAS
5. Adicione apenas as 6 variáveis acima

### **Opção B: Editar Manual (Mais Trabalhoso)**

1. Mantenha apenas estas 6 variáveis
2. Delete todas as outras uma por uma

---

## ✅ RESUMO FINAL:

Seu painel de variáveis deve ter **APENAS ESTAS 6**:

```
DATABASE_URL          = ${{Postgres.DATABASE_URL}}
PORT                  = 3001
NODE_ENV              = production
ML_APP_ID             = CONFIGURAR_DEPOIS
ML_SECRET             = CONFIGURAR_DEPOIS
ML_REDIRECT_URI       = ${{RAILWAY_PUBLIC_DOMAIN}}/api/auth/ml/callback
```

---

## 🔄 DEPOIS DE AJUSTAR:

O Railway vai fazer **redeploy automático** (~1-2 min).

Aguarde o card ficar verde novamente!

---

## 💡 POR QUE REMOVER AS OUTRAS?

- **Coolify**: Você não está usando Coolify, está usando Railway
- **Redis**: Não configuramos Redis ainda
- **DB_HOST, DB_USER, etc**: O `DATABASE_URL` já tem todas essas infos
- **JWT_SECRET, SESSION_SECRET**: O backend gera automaticamente se não existir
- **ENABLE_***: Features que vamos implementar depois
- **Frontend vars**: Vamos fazer deploy do frontend separado depois

---

**AGORA VOCÊ FAZ:**

1. Railway → `ml-gestao` → **Variables**
2. **Remover** variáveis extras
3. **Manter** apenas as 6 essenciais
4. **Aguardar** redeploy

**Me avise quando terminar!** 🚀
