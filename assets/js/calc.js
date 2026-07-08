/*
 * Lógica de cálculo da Calculadora de Custo — Impressão 3D (TNJ.3D)
 *
 * As fórmulas replicam exatamente a planilha "TNJ.3D - GESTÃO" (aba "Calculadora"):
 *   Custo do Filamento     = preço por Kg / 1000 * gramas utilizadas   (=B4/1000*B5)
 *   Custo de Energia       = consumo(W) / 1000 * horas * valor kWh     (=B8/1000*B9*B10)
 *   Mão de Obra            = valor informado                            (=B13)
 *   Custos Fixos (Manut.)  = taxa de manutenção por hora * horas        (=B14*B9)
 *   Insumos                = valor informado                            (=B16)
 *   CUSTO TOTAL            = soma dos itens acima
 *   Preço Sugerido (m%)    = custo total * (1 + m/100)
 *   Lucro Estimado (m%)    = preço sugerido - custo total
 *
 * Este módulo funciona tanto no navegador (window.TNJCalc) quanto no Node (module.exports).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.TNJCalc = api;
})(typeof self !== "undefined" ? self : this, function () {
  const MARGENS_PADRAO = [30, 50, 80, 100];

  function toNumber(value) {
    if (typeof value === "number") return isFinite(value) ? value : 0;
    if (value === null || value === undefined) return 0;
    // Aceita "1.234,56" e "1234.56"
    const normalizado = String(value)
      .trim()
      .replace(/\s|R\$/g, "")
      .replace(/\.(?=\d{3}(\D|$))/g, "")
      .replace(",", ".");
    const n = parseFloat(normalizado);
    return isFinite(n) ? n : 0;
  }

  // Converte a quantidade de filamento para gramas.
  function gramas(quantidade, unidade) {
    const q = toNumber(quantidade);
    return unidade === "kg" ? q * 1000 : q;
  }

  // Converte o tempo de impressão para horas.
  function horas(tempo, unidade) {
    const t = toNumber(tempo);
    return unidade === "min" ? t / 60 : t;
  }

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  /**
   * Calcula todos os custos a partir das entradas.
   * @param {Object} input
   * @returns {Object} resultado detalhado
   */
  function calcular(input) {
    const precoKg = toNumber(input.precoFilamentoKg);
    const g = gramas(input.quantidade, input.unidadeQuantidade || "g");
    const h = horas(input.tempo, input.unidadeTempo || "h");
    const consumoW = toNumber(input.consumoW);
    const valorKwh = toNumber(input.valorKwh);
    const maoDeObra = toNumber(input.maoDeObra);
    const taxaManutencaoHora = toNumber(input.taxaManutencaoHora);
    const insumos = toNumber(input.insumos);
    const margem = toNumber(input.margem);

    const custoFilamento = (precoKg / 1000) * g;
    const custoEnergia = (consumoW / 1000) * h * valorKwh;
    const custosFixos = taxaManutencaoHora * h;

    const custoTotal =
      custoFilamento + custoEnergia + maoDeObra + custosFixos + insumos;

    const precoSugerido = custoTotal * (1 + margem / 100);
    const lucroEstimado = precoSugerido - custoTotal;

    const tabela = MARGENS_PADRAO.map((m) => {
      const preco = custoTotal * (1 + m / 100);
      return {
        margem: m,
        precoSugerido: round2(preco),
        lucroEstimado: round2(preco - custoTotal),
      };
    });

    return {
      gramas: round2(g),
      horas: h,
      custos: {
        filamento: round2(custoFilamento),
        energia: round2(custoEnergia),
        maoDeObra: round2(maoDeObra),
        custosFixos: round2(custosFixos),
        insumos: round2(insumos),
      },
      custoTotal: round2(custoTotal),
      margem,
      precoSugerido: round2(precoSugerido),
      lucroEstimado: round2(lucroEstimado),
      tabelaMargens: tabela,
    };
  }

  return {
    MARGENS_PADRAO,
    toNumber,
    gramas,
    horas,
    round2,
    calcular,
  };
});
