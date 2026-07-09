/*
 * Lógica de cálculo da Calculadora de Custo — Impressão 3D (TNJ.3D)
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.TNJCalc = api;
})(typeof self !== "undefined" ? self : this, function () {
  const MARGENS_PADRAO = [30, 50, 80, 100];
  const MAX_FILAMENTOS = 4;

  function toNumber(value) {
    if (typeof value === "number") return isFinite(value) ? value : 0;
    if (value === null || value === undefined) return 0;
    const normalizado = String(value)
      .trim()
      .replace(/\s|R\$/g, "")
      .replace(/\.(?=\d{3}(\D|$))/g, "")
      .replace(",", ".");
    const n = parseFloat(normalizado);
    return isFinite(n) ? n : 0;
  }

  function gramas(quantidade, unidade) {
    const q = toNumber(quantidade);
    return unidade === "kg" ? q * 1000 : q;
  }

  function horas(tempo, unidade) {
    const t = toNumber(tempo);
    return unidade === "min" ? t / 60 : t;
  }

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function normalizarFilamentos(input) {
    if (Array.isArray(input.filamentos) && input.filamentos.length) {
      return input.filamentos
        .filter((f) => f && f.ativo !== false)
        .slice(0, MAX_FILAMENTOS)
        .map((f) => ({
          material: f.material || "",
          precoFilamentoKg: toNumber(f.precoFilamentoKg),
          quantidade: f.quantidade,
          unidadeQuantidade: f.unidadeQuantidade || "g",
          tempo: f.tempo,
          unidadeTempo: f.unidadeTempo || "h",
        }));
    }
    return [
      {
        material: input.material || "",
        precoFilamentoKg: toNumber(input.precoFilamentoKg),
        quantidade: input.quantidade,
        unidadeQuantidade: input.unidadeQuantidade || "g",
        tempo: input.tempo,
        unidadeTempo: input.unidadeTempo || "h",
      },
    ];
  }

  function calcular(input) {
    const lista = normalizarFilamentos(input);
    const consumoW = toNumber(input.consumoW);
    const valorKwh = toNumber(input.valorKwh);
    const maoDeObra = toNumber(input.maoDeObra);
    const taxaManutencaoHora = toNumber(input.taxaManutencaoHora);
    const insumos = toNumber(input.insumos);
    const margem = toNumber(input.margem);
    const qtdPecas = Math.max(1, Math.floor(toNumber(input.quantidadePecas) || 1));

    let custoFilamentoUnit = 0;
    let horasTotal = 0;
    const detalhesFilamentos = lista.map((f) => {
      const g = gramas(f.quantidade, f.unidadeQuantidade);
      const h = horas(f.tempo, f.unidadeTempo);
      const custo = (f.precoFilamentoKg / 1000) * g;
      custoFilamentoUnit += custo;
      horasTotal += h;
      return {
        material: f.material,
        precoFilamentoKg: f.precoFilamentoKg,
        gramas: round2(g),
        horas: h,
        custoUnitario: round2(custo),
      };
    });

    const h = horasTotal;
    const custoEnergiaUnit = (consumoW / 1000) * h * valorKwh;
    const custosFixosUnit = taxaManutencaoHora * h;

    const custoFilamento = custoFilamentoUnit * qtdPecas;
    const custoEnergia = custoEnergiaUnit * qtdPecas;
    const custosFixos = custosFixosUnit * qtdPecas;
    const maoDeObraTotal = maoDeObra * qtdPecas;
    const insumosTotal = insumos * qtdPecas;

    const custoTotalUnit =
      custoFilamentoUnit + custoEnergiaUnit + maoDeObra + custosFixosUnit + insumos;
    const custoTotal =
      custoFilamento + custoEnergia + maoDeObraTotal + custosFixos + insumosTotal;

    const precoSugerido = custoTotalUnit * (1 + margem / 100);
    const lucroEstimado = precoSugerido - custoTotalUnit;
    const precoSugeridoLote = precoSugerido * qtdPecas;
    const lucroEstimadoLote = lucroEstimado * qtdPecas;

    const tabela = MARGENS_PADRAO.map((m) => {
      const preco = custoTotalUnit * (1 + m / 100);
      return {
        margem: m,
        precoSugerido: round2(preco),
        lucroEstimado: round2(preco - custoTotalUnit),
      };
    });

    const filamentoResumo =
      detalhesFilamentos.length === 1
        ? detalhesFilamentos[0].material
        : detalhesFilamentos.map((f) => f.material).filter(Boolean).join(" + ");

    return {
      gramas: round2(detalhesFilamentos.reduce((s, f) => s + f.gramas, 0)),
      horas: h,
      quantidadePecas: qtdPecas,
      filamentos: detalhesFilamentos,
      filamentoResumo,
      custosUnitarios: {
        filamento: round2(custoFilamentoUnit),
        energia: round2(custoEnergiaUnit),
        maoDeObra: round2(maoDeObra),
        custosFixos: round2(custosFixosUnit),
        insumos: round2(insumos),
        total: round2(custoTotalUnit),
      },
      custos: {
        filamento: round2(custoFilamento),
        energia: round2(custoEnergia),
        maoDeObra: round2(maoDeObraTotal),
        custosFixos: round2(custosFixos),
        insumos: round2(insumosTotal),
      },
      custoTotalUnitario: round2(custoTotalUnit),
      custoTotal: round2(custoTotal),
      margem,
      precoSugerido: round2(precoSugerido),
      lucroEstimado: round2(lucroEstimado),
      precoSugeridoLote: round2(precoSugeridoLote),
      lucroEstimadoLote: round2(lucroEstimadoLote),
      tabelaMargens: tabela,
    };
  }

  return {
    MARGENS_PADRAO,
    MAX_FILAMENTOS,
    toNumber,
    gramas,
    horas,
    round2,
    calcular,
  };
});
