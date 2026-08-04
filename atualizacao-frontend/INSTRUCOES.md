# Atualização front-end — Painel Eleição 2026

Pacote com alterações para **líderes (pessoas)**, **coordenação no Financeiro** e **Agenda vinculada a líder**.

O banco Supabase já está pronto (`pessoas`, `coordenacoes` com DG01/DG02).

---

## Ordem de aplicação

### 1. `Codigo.gs`

| Arquivo | Ação |
|---------|------|
| `01-Codigo-gs-novas-funcoes.gs` | Cole as 4 funções perto de `getQgs` / `getCentrosCusto` |
| `02-Codigo-gs-getFinanceiro-SUBSTITUIR.gs` | Substitua a função `getFinanceiro` inteira |
| `03-Codigo-gs-getResumoPainel-ALTERACOES.gs` | Adicione `pessoas` e `coordenacoes` em `getResumoPainel` |

### 2. `Financeiro.html`

Abra `04-Financeiro-html-COORDENACAO.html` e aplique os 2 trechos (formulário + coluna na tabela).

### 3. `Agenda.html`

Abra `05-Agenda-html-LIDER-DROPDOWN.html` — troque o `<input>` de responsável pelo `<select>`.

### 4. `Lideres.html`

Abra `06-Lideres-html-PESSOAS.html` — cole a seção **antes** do painel de QGs.

### 5. `JavaScript.html`

Abra `07-JavaScript-html-ALTERACOES.js` e siga cada bloco numerado (edições pontuais + funções novas no final).

---

## Publicar no Google

No Mac, na pasta do projeto:

```bash
cd ~/eleicoes-2026-painel
npx clasp push
npx clasp deploy
```

Teste no painel:
- **Líderes e QGs** → cadastrar líder
- **Agenda** → responsável em dropdown + filtro por líder
- **Financeiro** → campo Coordenação (DG01 / DG02) na tabela e no formulário

---

## Checklist rápido

- [ ] `getPessoas`, `salvarPessoa`, `excluirPessoa`, `getCoordenacoes` em `Codigo.gs`
- [ ] `getFinanceiro` com join em `coordenacoes`
- [ ] `getResumoPainel` retorna `pessoas` e `coordenacoes`
- [ ] `#finCoordenacao` no formulário financeiro
- [ ] Coluna Coordenação na tabela financeira
- [ ] `#agResponsavel` como `<select>` na Agenda
- [ ] Seção `#tblPessoas` + `#modalPessoa` em Lideres.html
- [ ] `CACHE.pessoas`, `CACHE.coordenacoes`, `renderPessoas`, `popularDropdownLideresAgenda`
- [ ] `agendaFiltrada` usa `lider_id`
- [ ] `salvarAgendaForm` grava `lider_id`
- [ ] `clasp push` + `clasp deploy`

---

## Se algo quebrar

1. `npx clasp pull` — recupera a última versão do Google
2. Reaplique um arquivo por vez e teste
3. Console do navegador (F12) → aba Console para erros JS
