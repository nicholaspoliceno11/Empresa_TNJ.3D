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
    if (unidade === "hhmm" || String(tempo).includes(":")) {
      return parseTempoHHMM(tempo);
    }
    const t = toNumber(tempo);
    return unidade === "min" ? t / 60 : t;
  }

  function parseTempoHHMM(str) {
    const s = String(str || "").trim();
    if (!s) return 0;
    const m = s.match(/^(\d+):(\d{1,2})$/);
    if (m) return Number(m[1]) + Number(m[2]) / 60;
    return toNumber(s);
  }

  function formatHorasParaHHMM(horasDec) {
    const totalMin = Math.round(Math.max(0, Number(horasDec) || 0) * 60);
    const hh = Math.floor(totalMin / 60);
    const mm = totalMin % 60;
    return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
  }

  function normalizarInputHHMM(str) {
    const digits = String(str || "").replace(/\D/g, "").slice(0, 4);
    if (!digits) return "00:00";
    const padded = digits.padStart(4, "0");
    const mm = Math.min(59, Number(padded.slice(-2)));
    const hh = Number(padded.slice(0, -2));
    return formatHorasParaHHMM(hh + mm / 60);
  }

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  /**
   * Arredonda valores em R$ para múltiplos de R$ 0,05:
   * centavo terminando em 1–4 → sobe para X5; 6–9 → sobe para próximo X0; 0 e 5 mantém.
   */
  function arredondarMoeda(n) {
    const valor = toNumber(n);
    const neg = valor < 0;
    let centavosTotal = Math.round(Math.abs(valor) * 100);
    const reais = Math.floor(centavosTotal / 100);
    const cents = centavosTotal % 100;
    const ultimo = cents % 10;
    const dezena = Math.floor(cents / 10);

    let novoCents;
    if (ultimo === 0 || ultimo === 5) {
      novoCents = cents;
    } else if (ultimo >= 1 && ultimo <= 4) {
      novoCents = dezena * 10 + 5;
    } else {
      novoCents = (dezena + 1) * 10;
    }

    let resultado = novoCents >= 100 ? reais + 1 : reais + novoCents / 100;
    return neg ? -resultado : resultado;
  }

  function roundMoney(n) {
    return arredondarMoeda(round2(n));
  }

  function normalizarFilamentos(input) {
    if (Array.isArray(input.filamentos) && input.filamentos.length) {
      return input.filamentos
        .filter((f) => f && f.ativo !== false)
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
        custoUnitario: roundMoney(custo),
      };
    });

    const h = horasTotal;
    const custoEnergiaUnit = (consumoW / 1000) * h * valorKwh;
    const custosFixosUnit = taxaManutencaoHora * h;

    const cuFil = roundMoney(custoFilamentoUnit);
    const cuEn = roundMoney(custoEnergiaUnit);
    const cuMO = roundMoney(maoDeObra);
    const cuFix = roundMoney(custosFixosUnit);
    const cuIns = roundMoney(insumos);
    const custoTotalUnit = roundMoney(cuFil + cuEn + cuMO + cuFix + cuIns);

    const custoFilamento = roundMoney(cuFil * qtdPecas);
    const custoEnergia = roundMoney(cuEn * qtdPecas);
    const custosFixos = roundMoney(cuFix * qtdPecas);
    const maoDeObraTotal = roundMoney(cuMO * qtdPecas);
    const insumosTotal = roundMoney(cuIns * qtdPecas);
    const custoTotal = roundMoney(custoFilamento + custoEnergia + maoDeObraTotal + custosFixos + insumosTotal);

    const precoSugerido = roundMoney(custoTotalUnit * (1 + margem / 100));
    const lucroEstimado = roundMoney(precoSugerido - custoTotalUnit);
    const precoSugeridoLote = roundMoney(precoSugerido * qtdPecas);
    const lucroEstimadoLote = roundMoney(lucroEstimado * qtdPecas);

    const tabela = MARGENS_PADRAO.map((m) => {
      const preco = roundMoney(custoTotalUnit * (1 + m / 100));
      return {
        margem: m,
        precoSugerido: preco,
        lucroEstimado: roundMoney(preco - custoTotalUnit),
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
        filamento: cuFil,
        energia: cuEn,
        maoDeObra: cuMO,
        custosFixos: cuFix,
        insumos: cuIns,
        total: custoTotalUnit,
      },
      custos: {
        filamento: custoFilamento,
        energia: custoEnergia,
        maoDeObra: maoDeObraTotal,
        custosFixos: custosFixos,
        insumos: insumosTotal,
      },
      custoTotalUnitario: custoTotalUnit,
      custoTotal: custoTotal,
      margem,
      precoSugerido: precoSugerido,
      lucroEstimado: lucroEstimado,
      precoSugeridoLote: precoSugeridoLote,
      lucroEstimadoLote: lucroEstimadoLote,
      tabelaMargens: tabela,
    };
  }

  return {
    MARGENS_PADRAO,
    MAX_FILAMENTOS,
    toNumber,
    gramas,
    horas,
    parseTempoHHMM,
    formatHorasParaHHMM,
    normalizarInputHHMM,
    round2,
    roundMoney,
    arredondarMoeda,
    calcular,
  };
});
