# Como Recriar o Schema do PostgreSQL no Railway

## Problema
Se você migrou de SERIAL para UUID e as tabelas antigas ainda existem no PostgreSQL, você precisa recriá-las.

## Solução

### 1. No Railway Dashboard:
1. Acesse https://railway.app
2. Entre no projeto `ml-gestao-production`
3. Vá em **Variables**
4. Adicione a variável:
   - **Nome:** `RECREATE_SCHEMA`
   - **Valor:** `true`
5. Clique em **Deploy**

### 2. Após o Deploy (importante!):
1. Aguarde o deploy completar (~60 segundos)
2. Verifique os logs que deve mostrar: `✅ Tabelas antigas removidas!`
3. **REMOVA a variável `RECREATE_SCHEMA`** das variáveis de ambiente
4. Deixe o Railway fazer redeploy automático

## Por que remover depois?
A variável `RECREATE_SCHEMA=true` deve ser usada **apenas uma vez** para dropar as tabelas antigas. Se deixar ativa, ela vai dropar suas tabelas toda vez que o servidor reiniciar, apagando todos os dados!

## Verificar se funcionou
```bash
curl -X POST https://ml-gestao-production.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"teste@exemplo.com","password":"senha123","name":"Teste"}'
```

Deve retornar sucesso com o token JWT.
