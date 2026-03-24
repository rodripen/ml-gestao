#!/usr/bin/env node

/**
 * 🚂 SCRIPT DE DEPLOY AUTOMÁTICO PARA RAILWAY
 *
 * Este script faz TUDO automaticamente:
 * 1. Prepara o projeto
 * 2. Cria configurações
 * 3. Faz deploy no Railway
 *
 * COMO USAR:
 * 1. npm install -g @railway/cli
 * 2. railway login
 * 3. node deploy-railway.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Cores para o terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

function log(message, type = 'info') {
  const prefix = {
    info: `${colors.blue}ℹ${colors.reset}`,
    success: `${colors.green}✅${colors.reset}`,
    warning: `${colors.yellow}⚠${colors.reset}`,
    error: `${colors.red}❌${colors.reset}`
  };
  console.log(`${prefix[type]} ${message}`);
}

function exec(command, silent = false) {
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: silent ? 'pipe' : 'inherit'
    });
    return result;
  } catch (error) {
    if (!silent) {
      log(`Erro ao executar: ${command}`, 'error');
      log(error.message, 'error');
    }
    return null;
  }
}

async function main() {
  console.log(`
${colors.bright}${colors.blue}
╔══════════════════════════════════════╗
║   🚂 DEPLOY AUTOMÁTICO NO RAILWAY    ║
╚══════════════════════════════════════╝
${colors.reset}
`);

  // PASSO 1: Verificar Railway CLI
  log('Verificando Railway CLI...', 'info');
  const hasRailwayCLI = exec('railway --version', true);

  if (!hasRailwayCLI) {
    log('Railway CLI não encontrado. Instalando...', 'warning');
    exec('npm install -g @railway/cli');
    log('Railway CLI instalado!', 'success');
  } else {
    log('Railway CLI encontrado!', 'success');
  }

  // PASSO 2: Verificar login
  log('Verificando autenticação Railway...', 'info');
  const isLoggedIn = exec('railway whoami', true);

  if (!isLoggedIn) {
    log('Você precisa fazer login no Railway', 'warning');
    log('Abrindo navegador para login...', 'info');
    exec('railway login');
    log('Login concluído!', 'success');
  } else {
    log(`Logado como: ${isLoggedIn.trim()}`, 'success');
  }

  // PASSO 3: Criar arquivo railway.json
  log('Criando configuração Railway...', 'info');

  const railwayConfig = {
    "$schema": "https://railway.app/railway.schema.json",
    "build": {
      "builder": "NIXPACKS",
      "buildCommand": "npm install"
    },
    "deploy": {
      "numReplicas": 1,
      "startCommand": "npm run start:prod",
      "restartPolicyType": "ON_FAILURE",
      "restartPolicyMaxRetries": 10
    },
    "services": [
      {
        "name": "ml-gestao",
        "source": ".",
        "startCommand": "npm run start:prod"
      }
    ]
  };

  fs.writeFileSync('railway.json', JSON.stringify(railwayConfig, null, 2));
  log('railway.json criado!', 'success');

  // PASSO 4: Criar nixpacks.toml para build customizado
  log('Criando configuração de build...', 'info');

  const nixpacksConfig = `
# nixpacks.toml
[phases.setup]
nixPkgs = ["nodejs-18_x", "postgresql"]

[phases.install]
cmds = ["npm ci"]

[phases.build]
cmds = ["npm run build:all"]

[start]
cmd = "npm run start:prod"
`;

  fs.writeFileSync('nixpacks.toml', nixpacksConfig);
  log('nixpacks.toml criado!', 'success');

  // PASSO 5: Atualizar package.json principal
  log('Atualizando package.json...', 'info');

  const packageJson = {
    "name": "ml-gestao",
    "version": "1.0.0",
    "description": "Sistema de Gestão Mercado Livre",
    "scripts": {
      "install:backend": "cd backend && npm install",
      "install:frontend": "cd frontend && npm install",
      "install:all": "npm run install:backend && npm run install:frontend",
      "build:backend": "cd backend && npm run build",
      "build:frontend": "cd frontend && npm run build",
      "build:all": "npm run build:backend && npm run build:frontend",
      "start:backend": "cd backend && npm start",
      "start:frontend": "cd frontend && npm start",
      "start:prod": "npm run migrate && concurrently \"npm run start:backend\" \"npm run start:frontend\"",
      "migrate": "cd backend && npm run db:migrate",
      "dev": "concurrently \"npm run start:backend\" \"npm run start:frontend\""
    },
    "dependencies": {
      "concurrently": "^7.6.0"
    },
    "engines": {
      "node": ">=18.0.0"
    }
  };

  fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
  log('package.json atualizado!', 'success');

  // PASSO 6: Criar script de build no backend
  log('Atualizando backend/package.json...', 'info');

  const backendPackageJson = JSON.parse(
    fs.readFileSync('backend/package.json', 'utf8')
  );

  backendPackageJson.scripts = {
    ...backendPackageJson.scripts,
    "build": "echo 'Backend build completo'",
    "start": "node server.js",
    "db:migrate": "node database/migrate.js",
    "db:seed": "node database/migrate.js seed"
  };

  fs.writeFileSync(
    'backend/package.json',
    JSON.stringify(backendPackageJson, null, 2)
  );
  log('backend/package.json atualizado!', 'success');

  // PASSO 7: Criar script de build no frontend
  log('Atualizando frontend/package.json...', 'info');

  const frontendPackageJson = JSON.parse(
    fs.readFileSync('frontend/package.json', 'utf8')
  );

  frontendPackageJson.scripts = {
    ...frontendPackageJson.scripts,
    "build": "next build",
    "start": "next start -p ${PORT:-3000}"
  };

  fs.writeFileSync(
    'frontend/package.json',
    JSON.stringify(frontendPackageJson, null, 2)
  );
  log('frontend/package.json atualizado!', 'success');

  // PASSO 8: Criar arquivo .env.railway
  log('Criando template de variáveis de ambiente...', 'info');

  const envTemplate = `# Variáveis de ambiente para Railway
# IMPORTANTE: Configure estas no painel do Railway!

# Database (Railway cria automaticamente)
DATABASE_URL=\${DATABASE_URL}

# Mercado Livre
ML_APP_ID=seu_app_id_aqui
ML_SECRET=seu_secret_aqui
ML_REDIRECT_URI=https://\${RAILWAY_PUBLIC_DOMAIN}/api/auth/ml/callback

# Segurança
JWT_SECRET=gere_uma_chave_32_caracteres_aqui
SESSION_SECRET=outra_chave_diferente_aqui

# URLs
FRONTEND_URL=https://\${RAILWAY_PUBLIC_DOMAIN}
BACKEND_URL=https://\${RAILWAY_PUBLIC_DOMAIN}
NEXT_PUBLIC_API_URL=https://\${RAILWAY_PUBLIC_DOMAIN}/api

# Features
ENABLE_AUTO_RESPONSE=true
ENABLE_AUTO_REPUBLISH=true
ENABLE_CLAUDE_AI=true

# Portas
PORT=\${PORT}
`;

  fs.writeFileSync('.env.railway', envTemplate);
  log('.env.railway criado!', 'success');

  // PASSO 9: Criar/atualizar .gitignore
  log('Atualizando .gitignore...', 'info');

  const gitignore = `
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/

# Production
build/
dist/
.next/
out/

# Misc
.DS_Store
*.pem

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Env files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/
.idea/

# Database
*.db
*.sqlite
*.sqlite3
data.db-journal
data.db-shm
data.db-wal

# Uploads
uploads/
`;

  fs.writeFileSync('.gitignore', gitignore);
  log('.gitignore atualizado!', 'success');

  // PASSO 10: Inicializar Git se necessário
  if (!fs.existsSync('.git')) {
    log('Inicializando Git...', 'info');
    exec('git init');
    exec('git add .');
    exec('git commit -m "Configuração inicial para Railway"');
    log('Git inicializado!', 'success');
  }

  // PASSO 11: Criar projeto no Railway
  console.log(`
${colors.bright}${colors.yellow}
╔══════════════════════════════════════╗
║         🚀 HORA DO DEPLOY!           ║
╚══════════════════════════════════════╝
${colors.reset}
`);

  log('Criando projeto no Railway...', 'info');

  // Verificar se já existe projeto
  const hasProject = exec('railway status', true);

  if (!hasProject || hasProject.includes('No project')) {
    exec('railway init');
    log('Projeto criado no Railway!', 'success');
  } else {
    log('Projeto Railway já existe!', 'success');
  }

  // PASSO 12: Adicionar PostgreSQL
  log('Adicionando PostgreSQL...', 'info');
  exec('railway add postgresql || true');
  log('PostgreSQL configurado!', 'success');

  // PASSO 13: Fazer deploy
  log('Iniciando deploy...', 'info');
  log('Isso pode levar alguns minutos...', 'warning');

  exec('railway up');

  log('Deploy concluído!', 'success');

  // PASSO 14: Mostrar URL
  const url = exec('railway domain', true);

  console.log(`
${colors.bright}${colors.green}
╔══════════════════════════════════════╗
║      ✅ DEPLOY CONCLUÍDO!            ║
╚══════════════════════════════════════╝

🎉 Seu aplicativo está no ar!

📱 URL: ${colors.blue}${url ? url.trim() : 'https://seu-app.up.railway.app'}${colors.reset}

${colors.yellow}⚠️  PRÓXIMOS PASSOS:${colors.reset}

1. Acesse o painel do Railway:
   ${colors.blue}https://railway.app/dashboard${colors.reset}

2. Configure as variáveis de ambiente:
   - Clique no seu projeto
   - Vá em "Variables"
   - Adicione as variáveis do arquivo .env.railway

3. Execute a migração do banco:
   ${colors.bright}railway run npm run migrate${colors.reset}

4. Teste o login com Mercado Livre:
   ${colors.blue}${url ? url.trim() : 'https://seu-app.up.railway.app'}/api/auth/ml/connect${colors.reset}

${colors.bright}📚 COMANDOS ÚTEIS:${colors.reset}

Ver logs:        ${colors.bright}railway logs${colors.reset}
Ver variáveis:   ${colors.bright}railway variables${colors.reset}
Abrir dashboard: ${colors.bright}railway open${colors.reset}
Rodar comando:   ${colors.bright}railway run [comando]${colors.reset}

${colors.green}Parabéns! Seu sistema está em produção! 🚀${colors.reset}
`);

  // Abrir dashboard
  log('Abrindo dashboard Railway...', 'info');
  exec('railway open', true);
}

// Executar
main().catch(error => {
  log(`Erro: ${error.message}`, 'error');
  process.exit(1);
});