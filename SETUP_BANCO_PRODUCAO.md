# 🗄️ GUIA COMPLETO - CONFIGURAÇÃO DO BANCO DE DADOS

## 📋 VISÃO GERAL

O sistema agora usa **PostgreSQL** para suportar produção, multi-tenant e escala. SQLite foi substituído por ser limitado para produção.

### Por que PostgreSQL?
- ✅ **Multi-tenant** real com Row Level Security
- ✅ **Performance** para milhares de usuários
- ✅ **JSONB** para dados flexíveis
- ✅ **Full-text search** nativo
- ✅ **Índices avançados** (GIN, GiST)
- ✅ **Transações ACID** completas

---

## 🚀 OPÇÕES DE HOSPEDAGEM (GRÁTIS)

### 1️⃣ **SUPABASE (RECOMENDADO)** 🟢
**500MB grátis, interface excelente, fácil de usar**

#### Como configurar:
1. Acesse https://supabase.com
2. Clique em "Start your project"
3. Faça login com GitHub
4. Clique em "New Project"
5. Preencha:
   - Name: `ml-gestao`
   - Database Password: (anote esta senha!)
   - Region: `South America (São Paulo)`
6. Clique em "Create new project"
7. Aguarde criação (2-3 min)
8. Vá em **Settings → Database**
9. Copie a **Connection string** em "Connection Pooling"
10. Cole no `.env`:

```env
DATABASE_URL=postgresql://postgres:[SUA-SENHA]@db.[SEU-PROJETO].supabase.co:5432/postgres
```

#### Vantagens:
- Interface web para ver/editar dados
- Logs e métricas em tempo real
- Backup automático diário
- API REST automática
- Autenticação integrada

---

### 2️⃣ **NEON** 🟡
**3GB grátis, performance excelente**

#### Como configurar:
1. Acesse https://neon.tech
2. Sign up com GitHub/Google
3. Create database
4. Copie connection string
5. Cole no `.env`:

```env
DATABASE_URL=postgresql://user:pass@ep-xxx.sa-east-1.aws.neon.tech/neondb?sslmode=require
```

#### Vantagens:
- 3GB de storage (6x mais que Supabase)
- Branching de banco (como Git!)
- Serverless (escala automaticamente)

---

### 3️⃣ **RAILWAY** 🔵
**$5 de crédito grátis/mês**

#### Como configurar:
1. Acesse https://railway.app
2. Login com GitHub
3. New Project → PostgreSQL
4. Copie DATABASE_URL do painel
5. Cole no `.env`

---

### 4️⃣ **RENDER** 🟣
**90 dias grátis, depois pago**

#### Como configurar:
1. Acesse https://render.com
2. Sign up
3. New → PostgreSQL
4. Free plan
5. Copie connection string

---

## 💻 INSTALAÇÃO LOCAL (Desenvolvimento)

### Windows
```bash
# Baixar PostgreSQL
https://www.postgresql.org/download/windows/

# Ou usando Chocolatey
choco install postgresql
```

### Mac
```bash
brew install postgresql@14
brew services start postgresql@14
```

### Linux
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Criar banco local:
```sql
sudo -u postgres psql

CREATE DATABASE ml_gestao_dev;
CREATE USER ml_user WITH ENCRYPTED PASSWORD 'senha123';
GRANT ALL PRIVILEGES ON DATABASE ml_gestao_dev TO ml_user;
\q
```

---

## ⚙️ CONFIGURAÇÃO DO PROJETO

### 1. Instalar dependências
```bash
cd backend
npm install pg dotenv
```

### 2. Configurar .env
```bash
# Copiar template
cp .env.example .env

# Editar com suas credenciais
nano .env
```

### 3. Executar migração
```bash
# Criar estrutura do banco
npm run db:migrate

# Ou recriar do zero
npm run db:migrate:fresh

# Popular com dados de teste
npm run db:seed
```

---

## 📊 ESTRUTURA DO BANCO

### Tabelas Principais:

#### 🔐 **Autenticação e Multi-tenant**
- `users` - Usuários do sistema
- `stores` - Lojas/contas do ML

#### 🤖 **Sistema de IA**
- `qa_history` - Histórico de perguntas/respostas
- `ai_knowledge_base` - Base de conhecimento
- `sku_groups` - Grupos de produtos
- `response_templates` - Templates de resposta
- `ai_training_feedback` - Feedback para treinamento

#### 📦 **Gestão de Anúncios**
- `republication_history` - Histórico de republicações
- `title_variations` - Variações de títulos
- `post_sales_issues` - Problemas pós-venda

#### 📈 **Métricas**
- `ai_performance_metrics` - Performance da IA

### Recursos Especiais:

#### 🔍 **Busca Full-Text**
```sql
-- Já configurado para buscar em perguntas/respostas
SELECT * FROM qa_history
WHERE to_tsvector('portuguese', question_text) @@ to_tsquery('frete');
```

#### 📊 **JSONB para dados flexíveis**
```sql
-- Armazenar dados complexos do ML
item_data JSONB -- Snapshot completo do item
trigger_conditions JSONB -- Condições complexas
```

#### 🔒 **Row Level Security (RLS)**
```sql
-- Isolamento automático por tenant
-- Usuário só vê dados da própria loja
```

---

## 🛠️ COMANDOS ÚTEIS

### NPM Scripts (adicionar ao package.json):
```json
{
  "scripts": {
    "db:migrate": "node database/migrate.js",
    "db:migrate:fresh": "node database/migrate.js fresh",
    "db:seed": "node database/migrate.js seed",
    "db:reset": "node database/migrate.js reset"
  }
}
```

### Verificar conexão:
```javascript
// test-db.js
const { getDatabase } = require('./database/config');

async function test() {
  const db = getDatabase();
  await db.connect();

  const result = await db.query('SELECT NOW()');
  console.log('Conectado!', result.rows[0]);

  await db.disconnect();
}

test();
```

### Backup do banco:
```bash
# Supabase - fazer pelo painel
# Neon - fazer pelo painel
# Local:
pg_dump ml_gestao_dev > backup.sql
```

---

## 🔧 TROUBLESHOOTING

### Erro: "password authentication failed"
```bash
# Verificar connection string
# Verificar senha está correta
# No Supabase, use a senha que você criou, não a API key
```

### Erro: "SSL required"
```env
# Adicionar ao final da connection string:
DATABASE_URL=postgres://...?sslmode=require
```

### Erro: "too many connections"
```javascript
// Verificar se não está criando múltiplas conexões
// Usar singleton pattern (já implementado)
```

### Performance lenta:
```sql
-- Verificar índices
\d+ qa_history

-- Analisar query
EXPLAIN ANALYZE SELECT ...
```

---

## 📈 MONITORAMENTO

### Supabase:
- Dashboard → Database → Metrics
- Ver queries lentas
- Monitorar uso de storage

### Neon:
- Dashboard → Monitoring
- Query insights
- Storage usage

### Local:
```sql
-- Ver queries rodando
SELECT * FROM pg_stat_activity;

-- Ver tamanho das tabelas
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 🚨 SEGURANÇA

### 1. **Nunca commitar .env**
```bash
# .gitignore
.env
.env.local
```

### 2. **Usar secrets em produção**
```bash
# Vercel
vercel secrets add database-url "postgresql://..."

# Heroku
heroku config:set DATABASE_URL="postgresql://..."
```

### 3. **Rotação de senhas**
- Trocar senha a cada 90 dias
- Usar senhas fortes (mínimo 16 chars)

### 4. **Backup regular**
- Configurar backup automático diário
- Testar restauração periodicamente

---

## 🎯 PRÓXIMOS PASSOS

1. **Escolher serviço** (Supabase recomendado)
2. **Criar conta e projeto**
3. **Copiar connection string**
4. **Configurar .env**
5. **Rodar migração**
6. **Testar conexão**

```bash
# Comando completo de setup:
cd backend
cp .env.example .env
# [Editar .env com suas credenciais]
npm install pg dotenv
npm run db:migrate
node test-db.js
```

---

## 💡 DICAS PRO

### 1. **Conexão Pool**
```javascript
// Já configurado, mas ajuste se necessário
max: 20, // desenvolvimento
max: 50, // produção
```

### 2. **Índices customizados**
```sql
-- Se uma query específica estiver lenta
CREATE INDEX idx_custom ON table(column);
```

### 3. **Vacuum regular**
```sql
-- Limpar espaço não utilizado
VACUUM ANALYZE;
```

### 4. **Particionamento** (futuro)
```sql
-- Quando tiver milhões de registros
-- Particionar qa_history por mês
```

---

## ✅ CHECKLIST DE PRODUÇÃO

- [ ] Banco em nuvem configurado
- [ ] Connection string no .env
- [ ] Migração executada com sucesso
- [ ] Backup automático configurado
- [ ] SSL habilitado
- [ ] Monitoramento ativo
- [ ] Secrets seguros (não no código)
- [ ] Rate limiting configurado
- [ ] Índices otimizados

---

## 📞 SUPORTE

### Problemas com banco?
1. Verificar logs do serviço
2. Testar connection string
3. Verificar firewall/IP whitelist
4. Consultar documentação do serviço

### Links úteis:
- [Supabase Docs](https://supabase.com/docs)
- [Neon Docs](https://neon.tech/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

---

**Pronto! Seu banco está preparado para produção e escala! 🚀**