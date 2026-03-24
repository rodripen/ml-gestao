@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================
echo    DEPLOY AUTOMATICO NO RAILWAY
echo ========================================
echo.

REM Verificar se o Railway CLI esta instalado
where railway >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Railway CLI nao encontrado. Instalando...
    npm install -g @railway/cli
    echo [OK] Railway CLI instalado!
) else (
    echo [OK] Railway CLI encontrado!
)

REM Fazer login no Railway
echo.
echo [*] Verificando login Railway...
railway whoami >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Fazendo login no Railway...
    railway login
)

REM Instalar dependencias root
echo.
echo [*] Instalando concurrently...
npm install concurrently --save

REM Criar projeto Railway
echo.
echo [*] Inicializando projeto Railway...
railway init --name ml-gestao

REM Adicionar PostgreSQL
echo.
echo [*] Adicionando PostgreSQL...
railway add

REM Deploy
echo.
echo [*] Fazendo deploy (pode levar alguns minutos)...
railway up

REM Mostrar URL
echo.
echo ========================================
echo    DEPLOY CONCLUIDO!
echo ========================================
echo.
echo Seu app esta no ar!
echo.
echo PROXIMO PASSO:
echo 1. Acesse: https://railway.app/dashboard
echo 2. Configure as variaveis de ambiente
echo 3. Execute: railway run npm run migrate
echo.
echo Para ver os logs: railway logs
echo Para abrir o painel: railway open
echo.

railway open

pause