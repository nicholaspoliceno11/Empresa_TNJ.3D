#!/usr/bin/env bash
# Corrige "window is not defined", remove arquivos inválidos e republica o painel.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ "$SCRIPT_DIR" == */scripts ]]; then
  ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
else
  ROOT="$SCRIPT_DIR"
fi
cd "$ROOT"

echo "==> Pasta do projeto: $ROOT"

if [ ! -f package.json ]; then
  echo "ERRO: package.json não encontrado em $ROOT"
  echo "      Rode este script dentro de ~/eleicoes-2026-painel"
  exit 1
fi

if [ ! -f node_modules/.bin/clasp ]; then
  echo "==> Instalando dependências (clasp)..."
  npm install
fi

CLASP="npx clasp"

if [ ! -f "$HOME/.clasprc.json" ]; then
  echo "ERRO: clasp não está logado. Rode: npx clasp login"
  exit 1
fi

echo "==> 1/6 Removendo arquivos que NÃO pertencem ao Apps Script..."
rm -rf assets/ apps-script/ index.html

echo "==> 2/6 Configurando .clasp.json e .claspignore..."
cat > .clasp.json << 'EOF'
{
  "scriptId": "1epspmLLlbedpTZ8HzeGB0-XMI06kMe4ozDOTdwLmwfRsMaHvaMr7pd0Y",
  "rootDir": "."
}
EOF

cat > .claspignore << 'EOF'
node_modules/**
package.json
package-lock.json
.git/**
.gitignore
assets/**
index.html
atualizacao-frontend/**
apps-script/**
scripts/**
docs/**
README.md
corrigir-e-deploy.sh
EOF

echo "==> 3/6 Baixando código atual do Google (clasp pull)..."
$CLASP pull

echo "==> 4/6 Limpando lixo local novamente (se voltou no pull)..."
rm -rf assets/ apps-script/ index.html

echo "==> 5/6 Enviando para o Google (clasp push)..."
$CLASP push --force

echo "==> 6/6 Publicando nova versão (clasp deploy)..."
$CLASP deploy --description "Eleições 2026 — correção assets"

echo ""
echo "OK! Abra a URL /exec do painel e teste o login."
$CLASP deployments 2>/dev/null || true
