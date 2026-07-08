# AGENTS.md

## Cursor Cloud specific instructions

Projeto **TNJ.3D** — site estático (GitHub Pages) + Google Apps Script, com a planilha
Google como banco de dados. Não há build: os arquivos em `assets/` são servidos direto.

### Serviços e comandos

- **Site (frontend estático)** — comandos em `package.json`:
  - `npm run dev` → serve em `http://localhost:8080` (via `http-server`).
  - `npm test` → roda os testes das fórmulas (`node --test`, sem dependências extras).
  - `npm run lint` → ESLint (flat config em `eslint.config.js`).
- **Backend** (`apps-script/Codigo.gs`) roda no Google Apps Script, **não** localmente.
  Não há como testá-lo neste ambiente sem uma implantação na conta Google do dono da
  planilha.

### Gotchas importantes

- **Modo demonstração**: quando `API_URL` em `assets/js/config.js` está vazia, o site
  usa a lista `FILAMENTOS_DEMO` embutida e apenas simula o salvamento. Isso permite rodar
  e testar toda a calculadora localmente sem a planilha. Para produção, preencher
  `API_URL` com a URL `/exec` do App da Web (ver README).
- **As fórmulas ficam em `assets/js/calc.js`** e são compartilhadas entre o navegador e os
  testes (padrão UMD). Ao mudar uma fórmula, atualize os testes em `test/calc.test.js`
  (o caso base foi extraído da planilha real: custo total R$ 10,26).
- **Quantidade** aceita `g` ou `Kg` e **tempo** aceita `horas` ou `min` — a conversão é
  feita em `calc.js`. O exemplo real da planilha usa gramas.
- O Apps Script grava cada custo em abas separadas (`Projetos`, `Custo de Filamento`,
  `Energia`, `Mão de Obra`, `Manutenção`, `Insumos`) e cria a aba/cabeçalho se não existir
  (não destrutivo).
