# TNJ.3D — Gestão &amp; Calculadora de Custos (Impressão 3D)

Site de gestão de vendas e **calculadora de custos** para impressão 3D, feito para rodar
de graça com **GitHub Pages** (frontend) + **Google Apps Script** (backend) usando a
sua **planilha Google** como banco de dados.

```
[Site no GitHub Pages]  ──fetch──►  [Google Apps Script (App da Web)]  ──►  [Planilha Google]
   HTML/CSS/JS                         API doGet/doPost (JSON)                banco de dados
```

## Funcionalidades

- **Seleção automática de filamento**: ao escolher o filamento (lista vinda da aba
  `Filamentos`), o preço por Kg é preenchido automaticamente.
- **Cálculo automático** de todos os custos, com as mesmas fórmulas da sua planilha:
  - Custo do Filamento = `preço/Kg ÷ 1000 × gramas`
  - Custo de Energia = `consumo(W) ÷ 1000 × horas × valor kWh`
  - Mão de Obra, Custos Fixos (Manutenção = `taxa/h × horas`), Insumos
  - Custo total, preço sugerido e lucro por margem (30/50/80/100%)
- Quantidade em **g ou Kg** e tempo em **horas ou minutos**.
- Botão **Criar custo**: grava o resultado separado em cada aba
  (`Projetos`, `Custo de Filamento`, `Energia`, `Mão de Obra`, `Manutenção`, `Insumos`).
- Aba **Projetos** no site: lista os custos já registrados na planilha.

## Rodar localmente (desenvolvimento)

```bash
npm install     # instala as dependências de dev
npm run dev     # abre o site em http://localhost:8080
npm test        # roda os testes das fórmulas
npm run lint    # análise estática
```

Sem a API configurada, o site roda em **modo demonstração** (usa uma lista de
filamentos embutida e simula o salvamento), o que permite testar tudo localmente.

## Conectar à planilha (produção)

**Planilha:** [TNJ.3D — Gestão & Custos](https://docs.google.com/spreadsheets/d/1IRR33vv1pUYtr87Q6OpktZR3WfPHrXUrv2aOq4o1pAA/edit)

### Opção A — Pela interface do site (mais rápido)

1. Abra o site e vá na aba **Configuração**.
2. Siga os passos na tela para implantar o Apps Script na planilha.
3. Cole a URL `/exec` e clique em **Conectar**.

A URL fica salva no navegador (localStorage). Ideal para testar antes de publicar.

### Opção B — Via CLI (`clasp`) — recomendado para o backend

O projeto já está vinculado ao Apps Script
[1epspmLLlbedpTZ8HzeGB0-XMI06kMe4ozDOTdwLmwfRsMaHvaMr7pd0Y](https://script.google.com/home/projects/1epspmLLlbedpTZ8HzeGB0-XMI06kMe4ozDOTdwLmwfRsMaHvaMr7pd0Y/edit)
(ver `.clasp.json`).

**Pré-requisitos (uma vez):**

1. Ative a [Apps Script API](https://script.google.com/home/usersettings) na sua conta Google.
2. `npm install`
3. `npm run clasp:login` — autorize no navegador.

**Publicar alterações do backend:**

```bash
npm run clasp:push      # envia apps-script/Codigo.gs para o Google
npm run clasp:deploy    # cria nova versão da implantação (App da Web)
```

O manifesto em `apps-script/appsscript.json` já define **Executar como: Eu** e
**Quem tem acesso: Qualquer pessoa**. Após o deploy, copie a URL `/exec` da implantação
(no editor ou com `clasp deployments`) e cole em `assets/js/config.js` (`API_URL`).

Comandos úteis:

| Comando | Descrição |
|---------|-----------|
| `npm run clasp:pull` | Baixa o código do Apps Script para `apps-script/` |
| `npm run clasp:push` | Envia o código local para o Apps Script |
| `npm run clasp:deploy` | Publica nova versão do App da Web |
| `npm run clasp:open` | Abre o projeto no editor do Google |

> **Erro "sem permissão para acessar o documento"?** Confira `PLANILHA_ID` em
> `apps-script/Codigo.gs`, rode `npm run clasp:push` e `npm run clasp:deploy` para
> publicar uma nova versão com **Executar como: Eu**.

### Opção C — Colar manualmente no editor

1. Abra a planilha › **Extensões › Apps Script** (ou use `npm run clasp:open`).
2. Cole o código de [`apps-script/Codigo.gs`](apps-script/Codigo.gs).
3. **Implantar › Nova implantação › App da Web** (Executar como: Eu; Qualquer pessoa).
4. Cole a URL `/exec` em [`assets/js/config.js`](assets/js/config.js).

> A aba `Filamentos` deve ter os cabeçalhos `Material | Valor | QTD` (como já está na sua
> planilha). As abas de custos são criadas/completadas automaticamente na primeira gravação.

## Publicar no GitHub Pages

1. No GitHub, vá em **Settings › Pages**.
2. Em **Source**, selecione a branch (ex.: `main`) e a pasta **/(root)**.
3. Salve. O site ficará disponível em `https://<usuario>.github.io/<repo>/`.

## Estrutura

```
index.html                 Página principal (calculadora + projetos)
assets/css/styles.css      Estilos
assets/js/calc.js          Fórmulas (usadas no site e nos testes)
assets/js/config.js        Configuração (API_URL, padrões, filamentos demo)
assets/js/app.js           Interface: carrega filamentos, calcula, salva
apps-script/Codigo.gs      Backend Google Apps Script
apps-script/appsscript.json Manifesto (clasp)
.clasp.json                Vínculo com o projeto no Google (scriptId)
test/calc.test.js          Testes das fórmulas
```
