# Corrigir erro: `window is not defined` (assets/js/app)

## Causa

A pasta `assets/js/app.js` veio de um scaffold de site estático **errado** para o Apps Script.
No GAS, arquivos `.js` rodam no **servidor** (sem `window`). Por isso o deploy quebra.

O painel real usa: `Index.html`, `JavaScript.html`, `Codigo.gs`, etc.

---

## Correção (no Mac)

```bash
cd ~/eleicoes-2026-painel

# 1. Remover arquivos que não pertencem ao Apps Script
rm -rf assets/
rm -f index.html
rm -rf apps-script/

# 2. Criar/atualizar .claspignore (copie o conteúdo de .claspignore desta pasta)

# 3. Enviar de novo
npx clasp push
npx clasp deploy
```

## Opcional: apagar do Google o arquivo fantasma

Se ainda der erro após o push:

```bash
npx clasp open
```

No editor Google, delete manualmente:
- `assets/js/app`
- `assets/js/config`
- `index` (minúsculo, se existir duplicado de `Index`)

Depois: `npx clasp pull` para sincronizar o local.

---

## Arquivos que DEVEM ir no push (≈13)

- `Codigo.gs` (ou `Codigo.js`)
- `appsscript.json`
- `Index.html`, `Login.html`, `JavaScript.html`, `Styles.html`
- `Painel.html`, `Financeiro.html`, `Agenda.html`, `Kanban.html`
- `Zonas.html`, `Lideres.html`, `Usuarios.html`

**Não** devem ir: `assets/`, `node_modules/`, `package.json`, `atualizacao-frontend/`
