/**
 * TNJ.3D — Backend (Google Apps Script) para o site de gestão/calculadora.
 *
 * Este script deve ficar VINCULADO à planilha "TNJ.3D - GESTÃO"
 * (abra a planilha › Extensões › Apps Script › cole este código).
 *
 * Publicação: Implantar › Nova implantação › Tipo "App da Web"
 *   - Executar como: Eu (você)
 *   - Quem tem acesso: Qualquer pessoa
 * Copie a URL /exec gerada e cole em assets/js/config.js (API_URL).
 *
 * Endpoints:
 *   GET  ?action=filamentos  -> lista da aba "Filamentos" (Material, Valor)
 *   GET  ?action=projetos    -> registros da aba "Projetos"
 *   GET  ?action=proximoId   -> próximo código automático de projeto
 *   POST {json do custo}     -> grava o custo separado em cada aba
 */

var ABA_FILAMENTOS = "Filamentos";
var ABA_PROJETOS = "Projetos";
var ABA_FILAMENTO_CUSTO = "Custo de Filamento";
var ABA_ENERGIA = "Energia";
var ABA_MAO_DE_OBRA = "Mão de Obra";
var ABA_MANUTENCAO = "Manutenção";
var ABA_INSUMOS = "Insumos";
var PREFIXO_PROJETO = "PRJ";

var CABECALHO_PROJETOS = [
  "Data", "ID", "Qtd Peças", "Impressora", "Filamento", "Custo Filamento", "Custo Energia",
  "Mão de Obra", "Custos Fixos", "Insumos", "Custo Total", "Custo Unitário",
  "Margem %", "Preço Sugerido", "Lucro Estimado",
];

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || "filamentos";
    if (action === "filamentos") {
      return json({ ok: true, filamentos: lerFilamentos() });
    }
    if (action === "projetos") {
      return json({ ok: true, projetos: lerProjetos() });
    }
    if (action === "proximoId") {
      return json({ ok: true, projetoId: proximoProjetoId() });
    }
    return json({ ok: false, error: "Ação desconhecida: " + action });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var resultado = gravarCusto(payload);
    return json({ ok: true, resultado: resultado });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/* -------------------- Leitura -------------------- */
function lerFilamentos() {
  var sheet = planilha().getSheetByName(ABA_FILAMENTOS);
  if (!sheet) throw new Error('Aba "' + ABA_FILAMENTOS + '" não encontrada.');
  var valores = sheet.getDataRange().getValues();
  var lista = [];
  // Assume cabeçalho na linha 1: Material | Valor | QTD
  for (var i = 1; i < valores.length; i++) {
    var material = valores[i][0];
    var valor = valores[i][1];
    if (material === "" || material === null) continue;
    lista.push({ material: String(material), valor: Number(valor) || 0 });
  }
  return lista;
}

function lerProjetos() {
  var sheet = planilha().getSheetByName(ABA_PROJETOS);
  if (!sheet) return [];
  var valores = sheet.getDataRange().getValues();
  var lista = [];
  var novoFormato = valores.length > 0 && String(valores[0][2] || "") === "Qtd Peças";
  for (var i = 1; i < valores.length; i++) {
    var r = valores[i];
    if (!r[1]) continue; // sem ID
    if (novoFormato) {
      lista.push({
        data: formatarData(r[0]),
        projetoId: String(r[1]),
        quantidadePecas: Number(r[2]) || 1,
        impressora: String(r[3] || ""),
        filamento: String(r[4] || ""),
        custoFilamento: Number(r[5]) || 0,
        custoEnergia: Number(r[6]) || 0,
        maoDeObra: Number(r[7]) || 0,
        custosFixos: Number(r[8]) || 0,
        insumos: Number(r[9]) || 0,
        custoTotal: Number(r[10]) || 0,
        margem: Number(r[12]) || 0,
        precoSugerido: Number(r[13]) || 0,
      });
    } else {
      lista.push({
        data: formatarData(r[0]),
        projetoId: String(r[1]),
        quantidadePecas: 1,
        impressora: "",
        filamento: String(r[2] || ""),
        custoFilamento: Number(r[3]) || 0,
        custoEnergia: Number(r[4]) || 0,
        maoDeObra: Number(r[5]) || 0,
        custosFixos: Number(r[6]) || 0,
        insumos: Number(r[7]) || 0,
        custoTotal: Number(r[8]) || 0,
        margem: Number(r[9]) || 0,
        precoSugerido: Number(r[10]) || 0,
      });
    }
  }
  return lista.reverse(); // mais recentes primeiro
}

/* -------------------- Gravação -------------------- */
function proximoProjetoId() {
  var hoje = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd");
  var sheet = planilha().getSheetByName(ABA_PROJETOS);
  var seq = 1;
  if (sheet && sheet.getLastRow() > 1) {
    seq = sheet.getLastRow();
  }
  return PREFIXO_PROJETO + "-" + hoje + "-" + String(seq).padStart(3, "0");
}

function gravarCusto(p) {
  var agora = new Date();
  var c = p.custos || {};
  var qtd = num(p.quantidadePecas) || 1;

  // 1) Resumo do projeto
  ensureSheet(ABA_PROJETOS, CABECALHO_PROJETOS).appendRow([
    agora, p.projetoId, qtd, String(p.impressora || ""), p.filamento,
    num(c.filamento), num(c.energia), num(c.maoDeObra),
    num(c.custosFixos), num(c.insumos), num(p.custoTotal), num(p.custoTotalUnitario),
    num(p.margem), num(p.precoSugerido), num(p.lucroEstimado),
  ]);

  // 2) Custo de Filamento
  ensureSheet(ABA_FILAMENTO_CUSTO, [
    "Data", "ID", "Qtd Peças", "Filamento", "Preço/Kg", "Qtd (g)", "Custo",
  ]).appendRow([
    agora, p.projetoId, qtd, p.filamento,
    num(p.precoFilamentoKg), num(p.quantidadeG), num(c.filamento),
  ]);

  // 3) Energia
  ensureSheet(ABA_ENERGIA, [
    "Data", "ID", "Impressora", "Consumo (W)", "Tempo (h)", "kWh", "Custo",
  ]).appendRow([
    agora, p.projetoId, String(p.impressora || ""),
    num(p.consumoW), num(p.horas), num(p.valorKwh), num(c.energia),
  ]);

  // 4) Mão de Obra
  ensureSheet(ABA_MAO_DE_OBRA, ["Data", "ID", "Custo"]).appendRow([
    agora, p.projetoId, num(c.maoDeObra),
  ]);

  // 5) Manutenção (custos fixos)
  ensureSheet(ABA_MANUTENCAO, ["Data", "ID", "Tempo (h)", "Custo"]).appendRow([
    agora, p.projetoId, num(p.horas), num(c.custosFixos),
  ]);

  // 6) Insumos
  ensureSheet(ABA_INSUMOS, ["Data", "ID", "Custo"]).appendRow([
    agora, p.projetoId, num(c.insumos),
  ]);

  return { projetoId: p.projetoId, custoTotal: num(p.custoTotal) };
}

/* -------------------- Utilitários -------------------- */
function planilha() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function ensureSheet(nome, cabecalho) {
  var ss = planilha();
  var sheet = ss.getSheetByName(nome);
  if (!sheet) sheet = ss.insertSheet(nome);
  if (sheet.getLastRow() === 0 && cabecalho) {
    sheet.appendRow(cabecalho);
    sheet.getRange(1, 1, 1, cabecalho.length).setFontWeight("bold");
  }
  return sheet;
}

function num(v) {
  var n = Number(v);
  return isNaN(n) ? 0 : n;
}

function formatarData(d) {
  if (d instanceof Date) {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
  }
  return String(d || "");
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
