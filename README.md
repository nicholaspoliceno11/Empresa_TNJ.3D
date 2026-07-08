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

1. Abra a planilha **TNJ.3D - GESTÃO** › menu **Extensões › Apps Script**.
2. Apague o conteúdo padrão e cole o código de [`apps-script/Codigo.gs`](apps-script/Codigo.gs).
3. Clique em **Implantar › Nova implantação**, escolha o tipo **App da Web**:
   - **Executar como:** Eu (sua conta)
   - **Quem tem acesso:** Qualquer pessoa
4. Autorize e **copie a URL** que termina em `/exec`.
5. Cole essa URL em [`assets/js/config.js`](assets/js/config.js), na variável `API_URL`.
6. Faça commit/push. Pronto: o site passa a ler e gravar na planilha.

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
test/calc.test.js          Testes das fórmulas
```
