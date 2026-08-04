# TNJ.3D — Gestão &amp; Calculadora de Custos (Impressão 3D)

Site de gestão de vendas e **calculadora de custos** para impressão 3D, feito para rodar
como frontend estático + **Google Apps Script** (backend) usando a sua **planilha Google**
como banco de dados.

```
[Site estático]  ──fetch──►  [Google Apps Script (App da Web)]  ──►  [Planilha Google]
 HTML/CSS/JS                    API doGet/doPost (JSON)                banco de dados
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

## Apps Script via CLI

**Planilha:** [TNJ.3D — Gestão & Custos](https://docs.google.com/spreadsheets/d/1IRR33vv1pUYtr87Q6OpktZR3WfPHrXUrv2aOq4o1pAA/edit)

**Projeto Apps Script:** [TNJ.3D Backend](https://script.google.com/home/projects/1epspmLLlbedpTZ8HzeGB0-XMI06kMe4ozDOTdwLmwfRsMaHvaMr7pd0Y/edit)

Este repositório já está vinculado ao projeto Apps Script pelo arquivo [`.clasp.json`](.clasp.json).
O código enviado pela CLI fica em [`apps-script/`](apps-script/).

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Faça login na conta Google que tem acesso ao projeto Apps Script:

   ```bash
   npm run apps-script:login
   ```

3. Envie o backend para o projeto Apps Script:

   ```bash
   npm run apps-script:push
   ```

4. Crie uma nova implantação do App da Web:

   ```bash
   npm run apps-script:deploy
   ```

5. Copie a URL que termina em `/exec` e use no site.

Comandos úteis:

```bash
npm run apps-script:status  # mostra diferenças locais/remotas
npm run apps-script:pull    # baixa alterações feitas no editor do Apps Script
npm run apps-script:open    # abre o projeto Apps Script no navegador
```

### Conectar à planilha pela interface do site

1. Abra o site e vá na aba **Configuração**.
2. Cole a URL `/exec` gerada pelo deploy via CLI.
3. Clique em **Conectar**.

A URL fica salva no navegador (localStorage). Ideal para testar antes de publicar.

### Conectar pela configuração do site

Se preferir deixar a conexão fixa no código, cole a URL `/exec` em
[`assets/js/config.js`](assets/js/config.js), na variável `API_URL`.

> **Erro "sem permissão para acessar o documento"?** O `Codigo.gs` precisa estar no Apps Script
> configurado em `.clasp.json`, com `PLANILHA_ID` correto, e uma **nova implantação**
> com **Executar como: Eu**.

> A aba `Filamentos` deve ter os cabeçalhos `Material | Valor | QTD` (como já está na sua
> planilha). As abas de custos são criadas/completadas automaticamente na primeira gravação.

## Publicar/usar o frontend

Não há build: os arquivos em `index.html`, `assets/css/` e `assets/js/` são servidos
diretamente. Para uso local, rode `npm run dev`. Em produção, hospede esses arquivos em
qualquer servidor estático e aponte o `API_URL` para a implantação `/exec` do Apps Script.

## Estrutura

```
index.html                 Página principal (calculadora + projetos)
assets/css/styles.css      Estilos
assets/js/calc.js          Fórmulas (usadas no site e nos testes)
assets/js/config.js        Configuração (API_URL, padrões, filamentos demo)
assets/js/app.js           Interface: carrega filamentos, calcula, salva
apps-script/Codigo.gs      Backend Google Apps Script
apps-script/appsscript.json Manifesto do Apps Script
test/calc.test.js          Testes das fórmulas
```
