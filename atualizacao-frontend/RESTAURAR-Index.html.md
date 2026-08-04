# Restaurar Index.html apagado no Mac

## O que aconteceu

No macOS, `index.html` e `Index.html` são o **mesmo arquivo**.
O comando `rm -f index.html` apagou o **Index.html** do painel.
O `Código.gs` linha 37 chama `createHtmlOutputFromFile('Index')` → erro.

---

## Correção rápida (2 min) — voltar implantação anterior

1. No editor Apps Script: **Implantar → Gerenciar implantações**
2. Clique em **Correção assets** (ou implantação ativa) → ícone **lápis (Editar)**
3. Em **Versão**, escolha **Versão 21** (ou anterior à "Correção assets")
4. Clique **Implantar**
5. Teste a URL `/exec` — o painel deve voltar

---

## Correção definitiva — restaurar arquivo e republicar

### Opção A — Histórico de versões no Google

1. `npx clasp open`
2. Menu **Arquivo → Histórico de versões** (ou ícone relógio)
3. Restaure uma versão **antes** de apagar o Index
4. No Mac:

```bash
cd ~/eleicoes-2026-painel
npx clasp pull
ls -la Index.html    # deve existir
rm -rf assets/       # só assets — NUNCA rm index.html
npx clasp push --force
npx clasp deploy --description "Restaurado Index.html"
```

### Opção B — Se Index.html ainda existir localmente

```bash
cd ~/eleicoes-2026-painel
ls Index.html
npx clasp push --force
npx clasp deploy
```

---

## Regra no Mac

| Comando | Seguro? |
|---------|---------|
| `rm -rf assets/` | Sim |
| `rm -f index.html` | **NÃO** — apaga Index.html |
