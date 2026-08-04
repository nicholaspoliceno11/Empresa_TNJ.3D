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

**Projeto Apps Script:** [TNJ.3D — script.google.com](https://script.google.com/home/projects/1epspmLLlbedpTZ8HzeGB0-XMI06kMe4ozDOTdwLmwfRsMaHvaMr7pd0Y/edit)

O deploy do backend é feito **via CLI** com o [`clasp`](https://github.com/google/clasp)
(ferramenta oficial do Google para Apps Script), sem depender do GitHub para publicar o
script — o repositório é só a fonte de verdade do código; o `push`/`deploy` acontece direto
da sua máquina para o Apps Script.

O projeto já vem configurado (veja [`.clasp.json`](.clasp.json) e
[`apps-script/appsscript.json`](apps-script/appsscript.json)), apontando para o script acima
com `rootDir` em `apps-script/`.

### Fluxo com clasp (CLI)

```bash
npm install              # instala o clasp como dependência de dev
npm run clasp:login      # login único (abre o navegador para autorizar sua conta Google)
npm run clasp:status     # confere quais arquivos serão enviados
npm run clasp:push       # envia apps-script/Codigo.gs + appsscript.json para o projeto
npm run clasp:deploy     # cria uma nova versão implantada (App da Web)
```

- `clasp login` só precisa ser feito uma vez por máquina (grava o token em
  `~/.clasprc.json`, **nunca** commitado).
- `clasp push` sobrescreve o conteúdo do projeto Apps Script com os arquivos locais de
  `apps-script/` — é o equivalente a "apagar e colar o código", mas automático.
- `clasp deploy` cria/atualiza a implantação de **App da Web**. Na primeira vez, use
  `npx clasp deploy --description "producao"`; da próxima em diante, `npm run clasp:deploy`
  atualiza a implantação existente (mesma URL `/exec`).
- Use `npm run clasp:open` para abrir o projeto no navegador quando precisar revisar
  permissões da implantação (Executar como / Quem tem acesso) manualmente.
- Use `npm run clasp:pull` se alguém editar o código direto no editor do Apps Script e você
  quiser trazer essas mudanças de volta para o repositório.

> A implantação de **App da Web** (Executar como: Eu / Quem tem acesso: Qualquer pessoa)
> só precisa ser criada uma vez pelo editor do Apps Script ou com `clasp deploy`; depois
> disso, `clasp push` + `clasp deploy` mantêm a mesma URL `/exec` atualizada.

### Configurar o site com a URL do App da Web

1. Depois do primeiro `clasp deploy`, copie a URL que termina em `/exec` (visível em
   **Implantar › Gerenciar implantações** no editor, ou na saída do `clasp deploy`).
2. Cole essa URL em [`assets/js/config.js`](assets/js/config.js), na variável `API_URL`.
3. Faça commit/push do `config.js`. Pronto: o site passa a ler e gravar na planilha.

Alternativamente, pela interface do site: abra a aba **Configuração**, cole a URL `/exec` e
clique em **Conectar** (fica salva no navegador via localStorage — ideal para testar antes
de publicar em `config.js`).

> **Erro "sem permissão para acessar o documento"?** O `Codigo.gs` precisa estar no Apps Script
> **da própria planilha** (ou vinculado a ela via `PLANILHA_ID`), com `PLANILHA_ID` correto, e uma
> **Nova versão** da implantação com **Executar como: Eu**.

> A aba `Filamentos` deve ter os cabeçalhos `Material | Valor | QTD` (como já está na sua
> planilha). As abas de custos são criadas/completadas automaticamente na primeira gravação.

## Publicar no GitHub Pages

1. No GitHub, vá em **Settings › Pages**.
2. Em **Source**, selecione a branch (ex.: `main`) e a pasta **/(root)**.
3. Salve. O site ficará disponível em `https://<usuario>.github.io/<repo>/`.

## Estrutura

```
index.html                    Página principal (calculadora + projetos)
assets/css/styles.css         Estilos
assets/js/calc.js             Fórmulas (usadas no site e nos testes)
assets/js/config.js           Configuração (API_URL, padrões, filamentos demo)
assets/js/app.js              Interface: carrega filamentos, calcula, salva
apps-script/Codigo.gs         Backend Google Apps Script
apps-script/appsscript.json   Manifesto do projeto Apps Script (usado pelo clasp)
.clasp.json                   Configuração do clasp (scriptId + rootDir)
test/calc.test.js             Testes das fórmulas
```
