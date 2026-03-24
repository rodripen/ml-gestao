@echo off
echo ========================================
echo   ML GESTAO - DEPLOY NO RAILWAY
echo ========================================
echo.

echo [PASSO 1] Verificando repositorio Git...
git status
if %errorlevel% neq 0 (
    echo ERRO: Git nao inicializado!
    pause
    exit /b 1
)
echo.

echo [PASSO 2] Suas URLs para configurar no Railway:
echo.
echo COPIE ESTAS INFORMACOES:
echo ========================================
echo.
echo 1. Repositorio GitHub:
echo    - Crie em: https://github.com/new
echo    - Nome: ml-gestao
echo    - Privado: Sim
echo.
echo 2. Comandos para enviar codigo:
echo.

set /p github_user="Digite seu usuario do GitHub: "
echo.
echo Execute estes comandos:
echo ========================================
echo git remote add origin https://github.com/%github_user%/ml-gestao.git
echo git branch -M main
echo git push -u origin main
echo ========================================
echo.

echo [PASSO 3] Agora acesse o Railway:
echo.
echo 1. Acesse: https://railway.app/
echo 2. Login com GitHub
echo 3. New Project ^> Deploy from GitHub repo
echo 4. Selecione: %github_user%/ml-gestao
echo 5. Adicione PostgreSQL (+ New ^> Database ^> PostgreSQL)
echo.
echo [PASSO 4] Configure as variaveis de ambiente:
echo ========================================
echo DATABASE_URL=${{Postgres.DATABASE_URL}}
echo ML_APP_ID=OBTER_EM_DEVELOPERS_ML
echo ML_SECRET=OBTER_EM_DEVELOPERS_ML
echo ML_REDIRECT_URI=${{RAILWAY_PUBLIC_DOMAIN}}/api/auth/ml/callback
echo PORT=3001
echo NODE_ENV=production
echo ========================================
echo.
echo [PASSO 5] Obter credenciais do ML:
echo.
echo 1. Acesse: https://developers.mercadolivre.com.br/
echo 2. Minhas aplicacoes ^> Criar nova aplicacao
echo 3. Copie App ID e Secret
echo 4. Configure no Railway
echo.

pause
