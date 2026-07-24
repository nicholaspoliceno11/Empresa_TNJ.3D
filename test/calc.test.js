const test = require("node:test");
const assert = require("node:assert");
const Calc = require("../assets/js/calc.js");

/*
 * Cenário base extraído da planilha real (aba "Calculadora"):
 *   Preço filamento: R$ 109,65 / Kg   |  Quantidade: 1,14 g
 *   Consumo: 200 W  |  Tempo: 0,12 h  |  kWh: R$ 0,85
 *   Mão de obra: R$ 10,00  |  Manutenção: R$ 0,97/h  |  Insumos: R$ 0
 *   Margem: 50%
 * Valores com arredondamento comercial (múltiplos de R$ 0,05).
 */
const base = {
  precoFilamentoKg: 109.65,
  quantidade: 1.14,
  unidadeQuantidade: "g",
  consumoW: 200,
  valorKwh: 0.85,
  tempo: 0.12,
  unidadeTempo: "h",
  maoDeObra: 10.0,
  taxaManutencaoHora: 0.97,
  insumos: 0,
  margem: 50,
};

test("arredondarMoeda: centavos 1-4 sobem para 5 e 6-9 para próximo 0", () => {
  assert.strictEqual(Calc.arredondarMoeda(12.93), 12.95);
  assert.strictEqual(Calc.arredondarMoeda(9.47), 9.5);
  assert.strictEqual(Calc.arredondarMoeda(1.67), 1.7);
  assert.strictEqual(Calc.arredondarMoeda(10.05), 10.05);
  assert.strictEqual(Calc.arredondarMoeda(10.1), 10.1);
});

test("custo do filamento (=preço/1000*g)", () => {
  assert.strictEqual(Calc.calcular(base).custos.filamento, 0.15);
});

test("custo de energia (=W/1000*h*kWh)", () => {
  assert.strictEqual(Calc.calcular(base).custos.energia, 0.05);
});

test("custos fixos / manutenção (=taxa/h * h)", () => {
  assert.strictEqual(Calc.calcular(base).custos.custosFixos, 0.15);
});

test("mão de obra e insumos passam direto", () => {
  const r = Calc.calcular(base);
  assert.strictEqual(r.custos.maoDeObra, 10.0);
  assert.strictEqual(r.custos.insumos, 0);
});

test("custo total com arredondamento comercial", () => {
  assert.strictEqual(Calc.calcular(base).custoTotal, 10.35);
});

test("preço sugerido com margem 50% (=total*1.5 por peça)", () => {
  assert.strictEqual(Calc.calcular(base).precoSugerido, 15.55);
});

test("preço sugerido permanece por peça com qtd > 1", () => {
  const r = Calc.calcular({ ...base, quantidadePecas: 2 });
  assert.strictEqual(r.precoSugerido, 15.55);
  assert.ok(r.precoSugeridoLote > r.precoSugerido);
  assert.strictEqual(r.lucroEstimado, 5.2);
  assert.strictEqual(r.custoTotal, 20.7);
});

test("tabela de margens 30/50/80/100", () => {
  const t = Calc.calcular(base).tabelaMargens;
  assert.deepStrictEqual(
    t.map((x) => x.margem),
    [30, 50, 80, 100]
  );
  assert.strictEqual(t[0].precoSugerido, 13.5);
  assert.strictEqual(t[3].precoSugerido, 20.7);
});

test("conversão de unidades: kg e minutos", () => {
  const r = Calc.calcular({
    ...base,
    quantidade: 0.00114,
    unidadeQuantidade: "kg",
    tempo: 7.2,
    unidadeTempo: "min",
  });
  assert.strictEqual(r.custos.filamento, 0.15);
  assert.strictEqual(r.custos.energia, 0.05);
});

test("toNumber aceita formato brasileiro", () => {
  assert.strictEqual(Calc.toNumber("R$ 1.234,56"), 1234.56);
  assert.strictEqual(Calc.toNumber("0,85"), 0.85);
  assert.strictEqual(Calc.toNumber(""), 0);
});

test("quantidade de peças multiplica o custo total do lote", () => {
  const r = Calc.calcular({ ...base, quantidadePecas: 3 });
  assert.strictEqual(r.quantidadePecas, 3);
  assert.strictEqual(r.custoTotalUnitario, 10.35);
  assert.strictEqual(r.custoTotal, 31.05);
});

test("múltiplos filamentos somam custos e tempos", () => {
  const r = Calc.calcular({
    filamentos: [
      {
        ativo: true,
        material: "PLA",
        precoFilamentoKg: 100,
        quantidade: 10,
        unidadeQuantidade: "g",
        tempo: 1,
        unidadeTempo: "h",
      },
      {
        ativo: true,
        material: "PETG",
        precoFilamentoKg: 80,
        quantidade: 5,
        unidadeQuantidade: "g",
        tempo: 0.5,
        unidadeTempo: "h",
      },
    ],
    consumoW: 200,
    valorKwh: 0.85,
    maoDeObra: 0,
    taxaManutencaoHora: 0,
    insumos: 0,
    margem: 0,
  });
  assert.strictEqual(r.filamentos.length, 2);
  assert.strictEqual(r.custos.filamento, 1.4);
  assert.strictEqual(r.horas, 1.5);
  assert.strictEqual(r.filamentoResumo, "PLA + PETG");
});

test("aceita mais de 4 filamentos ativos", () => {
  const filamentos = Array.from({ length: 5 }, (_, i) => ({
    ativo: true,
    material: `Cor ${i + 1}`,
    precoFilamentoKg: 100,
    quantidade: 1,
    unidadeQuantidade: "g",
    tempo: 0.1,
    unidadeTempo: "h",
  }));
  const r = Calc.calcular({
    filamentos,
    consumoW: 0,
    valorKwh: 0,
    maoDeObra: 0,
    taxaManutencaoHora: 0,
    insumos: 0,
    margem: 0,
  });
  assert.strictEqual(r.filamentos.length, 5);
  assert.strictEqual(r.custos.filamento, 0.5);
});
