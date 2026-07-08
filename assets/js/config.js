/*
 * Configuração do site TNJ.3D.
 *
 * >>> PASSO OBRIGATÓRIO PARA CONECTAR À PLANILHA <<<
 * Depois de publicar o Google Apps Script como "App da Web" (veja o README),
 * cole a URL gerada em API_URL abaixo. Enquanto estiver vazia, o site funciona
 * em MODO DEMONSTRAÇÃO usando a lista de filamentos embutida em FILAMENTOS_DEMO.
 */
window.TNJConfig = {
  // Cole aqui a URL do App da Web (termina em /exec) após implantar o Apps Script.
  // Ex.: "https://script.google.com/macros/s/AKfycb.../exec"
  API_URL:
    "https://script.google.com/macros/s/AKfycbw0ExZh2Y-TEl9UU1mvaAiUDhKDoHlKlaE0hOPwTeUcvnm6_NXkgLX9dT5Qzjs7ZvoJpQ/exec",

  // Planilha TNJ.3D — Gestão & Custos (vincule o Apps Script a esta planilha).
  PLANILHA_ID: "1IRR33vv1pUYtr87Q6OpktZR3WfPHrXUrv2aOq4o1pAA",
  PLANILHA_URL:
    "https://docs.google.com/spreadsheets/d/1IRR33vv1pUYtr87Q6OpktZR3WfPHrXUrv2aOq4o1pAA/edit",

  // Impressoras disponíveis (consumo em W usado no cálculo de energia).
  IMPRESSORAS: [
    { id: "a1", nome: "Bambum Lab A1", consumoW: 200 },
    { id: "a1-ams", nome: "Bambum Lab A1 - AMS", consumoW: 280 },
  ],

  // Prefixo do código automático de projeto (ex.: PRJ-20260708-001).
  PREFIXO_PROJETO: "PRJ",

  LOGO: "assets/img/logo.png",

  RESPONSAVEIS: ["Nicholas", "João", "Thelma"],

  FORMAS_PAGAMENTO: [
    { id: "PIX", nome: "PIX" },
    { id: "CC", nome: "CC (Cartão de Crédito)" },
    { id: "CD", nome: "CD (Cartão de Débito)" },
    { id: "CASH", nome: "CASH (Dinheiro)" },
  ],

  MAX_FILAMENTOS: 4,

  // Valores padrão iguais aos da planilha (aba "Calculadora").
  PADROES: {
    consumoW: 200,
    valorKwh: 0.85,
    maoDeObra: 10.0,
    taxaManutencaoHora: 0.97,
    insumos: 0,
    margem: 50,
  },

  // Usado apenas no modo demonstração (quando API_URL está vazia).
  // Em produção, a lista vem da aba "Filamentos" da planilha.
  FILAMENTOS_DEMO: [
    { material: "Filamento PETG - Branco", valor: 77.94 },
    { material: "Filamento PLA - Azul Ciano", valor: 109.59 },
    { material: "Filamento PLA Preto", valor: 109.65 },
    { material: "Filamento PLA Laranja", valor: 119.9 },
    { material: "Filamento PLA Bege", valor: 129.9 },
    { material: "Filamento PLA Amarelo", valor: 128.9 },
    { material: "Filamento PLA Marrom", valor: 138.0 },
    { material: "Filamento PLA Azul", valor: 130.0 },
    { material: "Filamento PLA Bordo", valor: 114.0 },
    { material: "Filamento PLA Vermelho", valor: 129.0 },
    { material: "Filamento PLA Verde", valor: 191.0 },
    { material: "Filamento PLA Bege Areia", valor: 109.59 },
    { material: "Filamento PLA Ouro Silk", valor: 109.59 },
    { material: "Filamento PLA Rosa Silk", valor: 109.59 },
    { material: "Filamento PLA Lilas Silk", valor: 109.59 },
    { material: "Filamento PLA Verde militar escuro", valor: 91.17 },
    { material: "Filamento PLA Branco Matte", valor: 91.17 },
    { material: "Filamento PLA Petroleo Silk", valor: 109.59 },
    { material: "Filamento PLA Rosa Claro", valor: 91.17 },
    { material: "Filamento PLA Cinza Grafite", valor: 109.59 },
    { material: "Filamento PLA Verde militar claro", valor: 91.17 },
    { material: "Filamento PLA Perola", valor: 91.17 },
  ],
};
