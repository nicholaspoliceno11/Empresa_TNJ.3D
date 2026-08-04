# Eleições 2026 — Painel de Gestão

Painel de gestão para campanha eleitoral 2026. Frontend estático (HTML/CSS/JS) +
**Google Apps Script** como backend, com planilha Google como banco de dados.

> **Projeto separado** do repositório `Empresa_TNJ.3D` (impressão 3D).

```
[Painel web]  ──fetch──►  [Apps Script (App da Web)]  ──►  [Planilha Google]
```

## Apps Script vinculado

- Editor: [abrir no Google](https://script.google.com/home/projects/1epspmLLlbedpTZ8HzeGB0-XMI06kMe4ozDOTdwLmwfRsMaHvaMr7pd0Y/edit)
- `scriptId` em `.clasp.json`

## Configuração inicial (uma vez)

1. **Ative a Apps Script API** em [script.google.com/home/usersettings](https://script.google.com/home/usersettings).
2. **Crie o repositório no GitHub** (ex.: `eleicoes-2026-painel`) e clone na sua máquina:

   ```bash
   git clone https://github.com/SEU_USUARIO/eleicoes-2026-painel.git
   cd eleicoes-2026-painel
   ```

3. Instale dependências e autentique o clasp:

   ```bash
   npm install
   npm run clasp:login
   ```

4. **Baixe o código que já está no Google** (importante — não sobrescreva o que você já tem lá):

   ```bash
   npm run clasp:pull
   ```

## Publicar alterações do backend

```bash
npm run clasp:push
npm run clasp:deploy
```

Copie a URL `/exec` da implantação (`npm run clasp:deployments` ou no editor) e cole em
`assets/js/config.js` → `API_URL`.

## Rodar o painel localmente

```bash
npm run dev
```

Abre em `http://localhost:8080`. Sem `API_URL`, o site mostra apenas a tela de configuração.

## Comandos úteis

| Comando | Descrição |
|---------|-----------|
| `npm run clasp:pull` | Baixa código do Apps Script |
| `npm run clasp:push` | Envia código local para o Google |
| `npm run clasp:deploy` | Nova versão do App da Web |
| `npm run clasp:open` | Abre o projeto no editor Google |
| `npm run clasp:deployments` | Lista implantações e URLs |

## Estrutura

```
index.html              Página principal do painel
assets/css/styles.css   Estilos
assets/js/config.js     API_URL e configurações
assets/js/app.js        Lógica do frontend
apps-script/Codigo.gs   Backend (sincronizado via clasp)
apps-script/appsscript.json  Manifesto do Apps Script
.clasp.json             Vínculo com o projeto Google
```
