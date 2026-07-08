const test = require("node:test");
const assert = require("node:assert");
const Calc = require("../assets/js/calc.js");

/*
 * Cenário base extraído da planilha real (aba "Calculadora"):
 *   Preço filamento: R$ 109,65 / Kg   |  Quantidade: 1,14 g
 *   Consumo: 200 W  |  Tempo: 0,12 h  |  kWh: R$ 0,85
 *   Mão de obra: R$ 10,00  |  Manutenção: R$ 0,97/h  |  Insumos: R$ 0
 *   Margem: 50%
 * Resultados esperados: Filamento 0,13 · Energia 0,02 · Fixos 0,12 · Total 10,26
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

test("custo do filamento (=preço/1000*g)", () => {
  assert.strictEqual(Calc.calcular(base).custos.filamento, 0.13);
});

test("custo de energia (=W/1000*h*kWh)", () => {
  assert.strictEqual(Calc.calcular(base).custos.energia, 0.02);
});

test("custos fixos / manutenção (=taxa/h * h)", () => {
  assert.strictEqual(Calc.calcular(base).custos.custosFixos, 0.12);
});

test("mão de obra e insumos passam direto", () => {
  const r = Calc.calcular(base);
  assert.strictEqual(r.custos.maoDeObra, 10.0);
  assert.strictEqual(r.custos.insumos, 0);
});

test("custo total bate com a planilha (R$ 10,26)", () => {
  assert.strictEqual(Calc.calcular(base).custoTotal, 10.26);
});

test("preço sugerido com margem 50% (=total*1.5)", () => {
  assert.strictEqual(Calc.calcular(base).precoSugerido, 15.39);
});

test("tabela de margens 30/50/80/100", () => {
  const t = Calc.calcular(base).tabelaMargens;
  assert.deepStrictEqual(
    t.map((x) => x.margem),
    [30, 50, 80, 100]
  );
  assert.strictEqual(t[0].precoSugerido, 13.34); // 10.26 * 1.30
  assert.strictEqual(t[3].precoSugerido, 20.52); // 10.26 * 2.00
});

test("conversão de unidades: kg e minutos", () => {
  const r = Calc.calcular({
    ...base,
    quantidade: 0.00114,
    unidadeQuantidade: "kg",
    tempo: 7.2,
    unidadeTempo: "min",
  });
  // 0,00114 kg = 1,14 g e 7,2 min = 0,12 h → mesmos resultados
  assert.strictEqual(r.custos.filamento, 0.13);
  assert.strictEqual(r.custos.energia, 0.02);
});

test("toNumber aceita formato brasileiro", () => {
  assert.strictEqual(Calc.toNumber("R$ 1.234,56"), 1234.56);
  assert.strictEqual(Calc.toNumber("0,85"), 0.85);
  assert.strictEqual(Calc.toNumber(""), 0);
});

test("quantidade de peças multiplica o custo total do lote", () => {
  const r = Calc.calcular({ ...base, quantidadePecas: 3 });
  assert.strictEqual(r.quantidadePecas, 3);
  assert.strictEqual(r.custoTotalUnitario, 10.26);
  assert.strictEqual(r.custoTotal, 30.79);
});
