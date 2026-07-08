/**
 * TNJ.3D — Backend (Google Apps Script) para o site de gestão/calculadora.
 *
 * Publicação: Implantar › Nova implantação › Tipo "App da Web"
 *   - Executar como: Eu (você)
 *   - Quem tem acesso: Qualquer pessoa
 *
 * GET (JSONP): filamentos, projetos, projetoDetalhe, proximoId, vendas, saidas, financeiro,
 *              inicializar, gravar (payload JSON)
 */

var ABA_FILAMENTOS = "Filamentos";
var ABA_PROJETOS = "Projetos";
var ABA_FILAMENTO_CUSTO = "Custo de Filamento";
var ABA_ENERGIA = "Energia";
var ABA_MAO_DE_OBRA = "Mão de Obra";
var ABA_MANUTENCAO = "Manutenção";
var ABA_INSUMOS = "Insumos";
var ABA_VENDAS = "Vendas";
var ABA_SAIDAS = "Saídas Fixas";
var PREFIXO_PROJETO = "PRJ";

var CABECALHO_PROJETOS = [
  "Data", "ID", "Qtd Peças", "Responsável", "Impressora", "Filamento",
  "Custo Filamento", "Custo Energia", "Mão de Obra", "Custos Fixos", "Insumos",
  "Custo Total", "Custo Unitário", "Margem %", "Preço Sugerido", "Lucro Estimado",
];

var CABECALHO_FIL_CUSTO = [
  "Data", "ID", "Qtd Peças", "Slot", "Filamento", "Preço/Kg", "Qtd (g)", "Tempo (h)", "Custo",
];

var CABECALHO_VENDAS = [
  "Data", "ID Projeto", "Valor Venda", "Forma Pagamento", "Responsável Venda",
  "Responsável Projeto", "Observações", "Custo Total", "Lucro",
];

var CABECALHO_SAIDAS = ["Data", "Descrição", "Valor"];

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || "filamentos";
    var result = rotearAcao(action, e);
    return outputJson(result, e);
  } catch (err) {
    return outputJson({ ok: false, error: String(err) }, e);
  }
}

function doPost(e) {
  try {
    var payload = parsePayload(e);
    var action = payload.action || "gravar";
    var result = rotearAcao(action, null, payload);
    return json(result);
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function rotearAcao(action, e, payload) {
  if (action === "filamentos") {
    return { ok: true, filamentos: lerFilamentos() };
  }
  if (action === "projetos") {
    return { ok: true, projetos: lerProjetos() };
  }
  if (action === "projetoDetalhe") {
    var pid = (e && e.parameter && e.parameter.projetoId) || (payload && payload.projetoId);
    var dataRef = (e && e.parameter && e.parameter.data) || (payload && payload.data) || "";
    return { ok: true, detalhe: lerProjetoDetalhe(pid, dataRef) };
  }
  if (action === "proximoId") {
    return { ok: true, projetoId: proximoProjetoId() };
  }
  if (action === "proximoIdReutilizacao") {
    var pidReu = (e && e.parameter && e.parameter.projetoId) || (payload && payload.projetoId);
    return { ok: true, projetoId: proximoIdReutilizacao(pidReu), idRaiz: extrairIdRaiz(pidReu) };
  }
  if (action === "vendas") {
    return { ok: true, vendas: lerVendas() };
  }
  if (action === "saidas") {
    return { ok: true, saidas: lerSaidas() };
  }
  if (action === "financeiro") {
    return { ok: true, resumo: calcularFinanceiro() };
  }
  if (action === "inicializar") {
    return { ok: true, abas: inicializarAbas() };
  }
  if (action === "gravar") {
    var dados = payload || JSON.parse(e.parameter.payload);
    return processarGravar(dados);
  }
  if (action === "gravarVenda") {
    return { ok: true, resultado: gravarVenda(payload) };
  }
  if (action === "gravarSaida") {
    return { ok: true, resultado: gravarSaida(payload) };
  }
  if (action === "adicionarFilamento") {
    return { ok: true, resultado: adicionarFilamento(payload) };
  }
  return { ok: false, error: "Ação desconhecida: " + action };
}

function processarGravar(dados) {
  var acao = dados.action;
  if (acao === "gravarVenda") {
    return { ok: true, resultado: gravarVenda(dados) };
  }
  if (acao === "gravarSaida") {
    return { ok: true, resultado: gravarSaida(dados) };
  }
  if (acao === "adicionarFilamento") {
    return { ok: true, resultado: adicionarFilamento(dados) };
  }
  return { ok: true, resultado: gravarCusto(dados) };
}

function parsePayload(e) {
  if (e && e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }
  if (e && e.postData && e.postData.contents) {
    return JSON.parse(e.postData.contents);
  }
  throw new Error("Corpo da requisição vazio");
}

/* -------------------- Leitura -------------------- */
function lerFilamentos() {
  var sheet = ensureSheet(ABA_FILAMENTOS, ["Material", "Valor", "QTD"]);
  var valores = sheet.getDataRange().getValues();
  var lista = [];
  for (var i = 1; i < valores.length; i++) {
    var material = valores[i][0];
    var valor = valores[i][1];
    if (material === "" || material === null) continue;
    lista.push({ material: String(material), valor: Number(valor) || 0 });
  }
  return lista;
}

function detectarFormatoProjetos(cab) {
  if (!cab || cab.length < 3) return "antigo";
  if (String(cab[2]) === "Qtd Peças" && String(cab[3]) === "Responsável") return "comResp";
  if (String(cab[2]) === "Qtd Peças") return "qtd";
  return "antigo";
}

function detectarFormatoFilCusto(cab) {
  if (!cab || cab.length < 4) return "antigo";
  if (String(cab[3]) === "Slot") {
    return String(cab[7] || "") === "Tempo (h)" ? "slotTempo" : "slot";
  }
  if (String(cab[2]) === "Qtd Peças") return "qtd";
  return "antigo";
}

function lerCabecalho(sheet) {
  if (!sheet || sheet.getLastRow() === 0) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function lerProjetos() {
  var sheet = obterAba(ABA_PROJETOS, null, false);
  if (!sheet) return [];
  var valores = sheet.getDataRange().getValues();
  if (valores.length < 2) return [];
  var formato = detectarFormatoProjetos(valores[0]);
  var lista = [];
  for (var i = 1; i < valores.length; i++) {
    var r = valores[i];
    if (!r[1]) continue;
    if (formato === "comResp") {
      lista.push({
        data: formatarData(r[0]),
        projetoId: String(r[1]),
        quantidadePecas: Number(r[2]) || 1,
        responsavelProjeto: String(r[3] || ""),
        impressora: String(r[4] || ""),
        filamento: String(r[5] || ""),
        custoFilamento: Number(r[6]) || 0,
        custoEnergia: Number(r[7]) || 0,
        maoDeObra: Number(r[8]) || 0,
        custosFixos: Number(r[9]) || 0,
        insumos: Number(r[10]) || 0,
        custoTotal: Number(r[11]) || 0,
        margem: Number(r[13]) || 0,
        precoSugerido: Number(r[14]) || 0,
      });
    } else if (formato === "qtd") {
      lista.push({
        data: formatarData(r[0]),
        projetoId: String(r[1]),
        quantidadePecas: Number(r[2]) || 1,
        responsavelProjeto: "",
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
        responsavelProjeto: "",
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
  return lista.reverse();
}

function datasCompativeis(d, ref) {
  if (!ref) return true;
  return formatarData(d) === String(ref);
}

function buscarLinhaProjeto(projetoId, dataRef) {
  var sheet = obterAba(ABA_PROJETOS, null, false);
  if (!sheet || sheet.getLastRow() < 2) return null;
  var valores = sheet.getDataRange().getValues();
  var formato = detectarFormatoProjetos(valores[0]);
  for (var i = valores.length - 1; i >= 1; i--) {
    var r = valores[i];
    if (String(r[1]) !== String(projetoId)) continue;
    if (!datasCompativeis(r[0], dataRef)) continue;
    return { row: r, formato: formato, data: r[0] };
  }
  return null;
}

function lerFilamentosRegistro(projetoId, dataReg) {
  var sheet = obterAba(ABA_FILAMENTO_CUSTO, null, false);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var valores = sheet.getDataRange().getValues();
  var formato = detectarFormatoFilCusto(valores[0]);
  var lista = [];
  for (var i = 1; i < valores.length; i++) {
    var row = valores[i];
    if (String(row[1]) !== String(projetoId)) continue;
    if (!datasCompativeis(row[0], dataReg)) continue;
    if (formato === "slotTempo") {
      lista.push({
        slot: Number(row[3]) || lista.length + 1,
        material: String(row[4] || ""),
        precoFilamentoKg: Number(row[5]) || 0,
        quantidade: Number(row[6]) || 0,
        unidadeQuantidade: "g",
        tempo: Number(row[7]) || 0,
        unidadeTempo: "h",
        ativo: true,
      });
    } else if (formato === "slot") {
      lista.push({
        slot: Number(row[3]) || lista.length + 1,
        material: String(row[4] || ""),
        precoFilamentoKg: Number(row[5]) || 0,
        quantidade: Number(row[6]) || 0,
        unidadeQuantidade: "g",
        tempo: 0,
        unidadeTempo: "h",
        ativo: true,
      });
    } else if (formato === "qtd") {
      lista.push({
        slot: lista.length + 1,
        material: String(row[3] || ""),
        precoFilamentoKg: Number(row[4]) || 0,
        quantidade: Number(row[5]) || 0,
        unidadeQuantidade: "g",
        tempo: 0,
        unidadeTempo: "h",
        ativo: true,
      });
    } else {
      lista.push({
        slot: lista.length + 1,
        material: String(row[2] || ""),
        precoFilamentoKg: Number(row[3]) || 0,
        quantidade: Number(row[4]) || 0,
        unidadeQuantidade: "g",
        tempo: 0,
        unidadeTempo: "h",
        ativo: true,
      });
    }
  }
  lista.sort(function (a, b) {
    return a.slot - b.slot;
  });
  return lista;
}

function lerEnergiaRegistro(projetoId, dataReg) {
  var sheet = obterAba(ABA_ENERGIA, null, false);
  if (!sheet || sheet.getLastRow() < 2) return {};
  var valores = sheet.getDataRange().getValues();
  for (var i = valores.length - 1; i >= 1; i--) {
    var row = valores[i];
    if (String(row[1]) !== String(projetoId)) continue;
    if (!datasCompativeis(row[0], dataReg)) continue;
    return {
      impressora: String(row[2] || ""),
      consumoW: Number(row[3]) || 0,
      horas: Number(row[4]) || 0,
      valorKwh: Number(row[5]) || 0,
    };
  }
  return {};
}

function lerManutencaoRegistro(projetoId, dataReg) {
  var sheet = obterAba(ABA_MANUTENCAO, null, false);
  if (!sheet || sheet.getLastRow() < 2) return {};
  var valores = sheet.getDataRange().getValues();
  var comTaxa = String(valores[0][2] || "") === "Taxa (R$/h)";
  for (var i = valores.length - 1; i >= 1; i--) {
    var row = valores[i];
    if (String(row[1]) !== String(projetoId)) continue;
    if (!datasCompativeis(row[0], dataReg)) continue;
    if (comTaxa) {
      return { taxa: Number(row[2]) || 0, horas: Number(row[3]) || 0 };
    }
    return { taxa: 0, horas: Number(row[2]) || 0 };
  }
  return {};
}

function lerProjetoDetalhe(projetoId, dataRef) {
  var id = String(projetoId || "").trim();
  if (!id) throw new Error("ID do projeto obrigatório");
  var encontrado = buscarLinhaProjeto(id, dataRef || "");
  if (!encontrado) throw new Error("Projeto não encontrado: " + id);

  var r = encontrado.row;
  var formato = encontrado.formato;
  var dataReg = encontrado.data;
  var qtd = 1;
  var responsavel = "";
  var impressora = "";
  var margem = 0;
  var maoObraBatch = 0;
  var insumosBatch = 0;

  if (formato === "comResp") {
    qtd = Number(r[2]) || 1;
    responsavel = String(r[3] || "");
    impressora = String(r[4] || "");
    maoObraBatch = Number(r[8]) || 0;
    insumosBatch = Number(r[10]) || 0;
    margem = Number(r[13]) || 0;
  } else if (formato === "qtd") {
    qtd = Number(r[2]) || 1;
    impressora = String(r[3] || "");
    maoObraBatch = Number(r[7]) || 0;
    insumosBatch = Number(r[9]) || 0;
    margem = Number(r[12]) || 0;
  } else {
    maoObraBatch = Number(r[5]) || 0;
    insumosBatch = Number(r[7]) || 0;
    margem = Number(r[9]) || 0;
  }

  var energia = lerEnergiaRegistro(id, dataReg);
  var manut = lerManutencaoRegistro(id, dataReg);
  var filamentos = lerFilamentosRegistro(id, dataReg);

  if (!filamentos.length && r[5]) {
    filamentos.push({
      slot: 1,
      material: String(formato === "comResp" || formato === "qtd" ? r[5] : r[2] || ""),
      precoFilamentoKg: 0,
      quantidade: 0,
      unidadeQuantidade: "g",
      tempo: energia.horas || manut.horas || 0,
      unidadeTempo: "h",
      ativo: true,
    });
  }

  filamentos.forEach(function (f) {
    if (!f.tempo && (energia.horas || manut.horas)) {
      f.tempo = energia.horas || manut.horas;
    }
  });

  return {
    projetoIdOrigem: id,
    dataRegistro: formatarData(dataReg),
    quantidadePecas: qtd,
    responsavelProjeto: responsavel,
    impressora: energia.impressora || impressora,
    consumoW: energia.consumoW || 0,
    valorKwh: energia.valorKwh || 0,
    taxaManutencaoHora: manut.taxa || 0,
    maoDeObra: round2(maoObraBatch / qtd),
    insumos: round2(insumosBatch / qtd),
    margem: margem,
    filamentos: filamentos,
  };
}

function lerVendas() {
  var sheet = obterAba(ABA_VENDAS, null, false);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var valores = sheet.getDataRange().getValues();
  var lista = [];
  for (var i = 1; i < valores.length; i++) {
    var r = valores[i];
    if (!r[1]) continue;
    lista.push({
      data: formatarData(r[0]),
      projetoId: String(r[1]),
      valorVenda: Number(r[2]) || 0,
      formaPagamento: String(r[3] || ""),
      responsavelVenda: String(r[4] || ""),
      responsavelProjeto: String(r[5] || ""),
      observacoes: String(r[6] || ""),
      custoTotal: Number(r[7]) || 0,
      lucro: Number(r[8]) || 0,
    });
  }
  return lista.reverse();
}

function lerSaidas() {
  var sheet = obterAba(ABA_SAIDAS, null, false);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var valores = sheet.getDataRange().getValues();
  var lista = [];
  for (var i = 1; i < valores.length; i++) {
    var r = valores[i];
    if (!r[1]) continue;
    lista.push({
      data: formatarData(r[0]),
      descricao: String(r[1]),
      valor: Number(r[2]) || 0,
    });
  }
  return lista.reverse();
}

function calcularFinanceiro() {
  var vendas = lerVendas();
  var saidas = lerSaidas();
  var entradas = 0;
  var custos = 0;
  var lucroVendas = 0;
  var maoDeObra = 0;

  vendas.forEach(function (v) {
    entradas += v.valorVenda;
    custos += v.custoTotal;
    lucroVendas += v.lucro;
    var proj = buscarProjeto(v.projetoId);
    if (proj) maoDeObra += proj.maoDeObra;
  });

  var totalSaidas = 0;
  saidas.forEach(function (s) {
    totalSaidas += s.valor;
  });

  return {
    entradas: round2(entradas),
    saidas: round2(totalSaidas),
    custos: round2(custos),
    lucro: round2(lucroVendas - totalSaidas),
    maoDeObra: round2(maoDeObra),
  };
}

function buscarProjeto(projetoId) {
  var lista = lerProjetos();
  for (var i = 0; i < lista.length; i++) {
    if (lista[i].projetoId === projetoId) return lista[i];
  }
  return null;
}

/* -------------------- Gravação -------------------- */
function proximoProjetoId() {
  var hoje = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd");
  var sheet = obterAba(ABA_PROJETOS, null, false);
  var seq = 1;
  if (sheet && sheet.getLastRow() > 1) {
    seq = sheet.getLastRow();
  }
  return PREFIXO_PROJETO + "-" + hoje + "-" + String(seq).padStart(3, "0");
}

/**
 * Gera ID derivado do projeto original: PRJ-20260707-002 → PRJ-20260707-002-20260708
 * Se já existir no mesmo dia, acrescenta -2, -3…
 */
function extrairIdRaiz(projetoId) {
  var m = String(projetoId || "").match(/^(PRJ-\d{8}-\d{3})/);
  return m ? m[1] : String(projetoId || "").trim();
}

function listarIdsProjetos() {
  var sheet = obterAba(ABA_PROJETOS, null, false);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var valores = sheet.getDataRange().getValues();
  var ids = [];
  for (var i = 1; i < valores.length; i++) {
    if (valores[i][1]) ids.push(String(valores[i][1]));
  }
  return ids;
}

function proximoIdReutilizacao(projetoId) {
  var raiz = extrairIdRaiz(projetoId);
  var hoje = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd");
  var prefixo = raiz + "-" + hoje;
  var ids = listarIdsProjetos();
  if (ids.indexOf(prefixo) < 0) return prefixo;
  var n = 2;
  while (ids.indexOf(prefixo + "-" + n) >= 0) n++;
  return prefixo + "-" + n;
}

function gravarCusto(p) {
  var agora = new Date();
  var c = p.custos || {};
  var qtd = num(p.quantidadePecas) || 1;
  var horas = round2(num(p.horas));

  var sheetProj = ensureSheet(ABA_PROJETOS, CABECALHO_PROJETOS);
  gravarLinhaProjeto(sheetProj, agora, p, c, qtd);

  var sheetFil = ensureSheet(ABA_FILAMENTO_CUSTO, CABECALHO_FIL_CUSTO);
  var fils = p.filamentos && p.filamentos.length ? p.filamentos : [
    {
      material: p.filamento || "",
      precoFilamentoKg: num(p.precoFilamentoKg),
      gramas: num(p.quantidadeG),
      horas: horas,
      custoUnitario: qtd > 0 ? num(c.filamento) / qtd : 0,
    },
  ];
  gravarLinhasFilamento(sheetFil, agora, p.projetoId, qtd, fils);

  ensureSheet(ABA_ENERGIA, [
    "Data", "ID", "Impressora", "Consumo (W)", "Tempo (h)", "kWh", "Custo",
  ]).appendRow([
    agora, p.projetoId, String(p.impressora || ""),
    num(p.consumoW), horas, num(p.valorKwh), num(c.energia),
  ]);

  ensureSheet(ABA_MAO_DE_OBRA, ["Data", "ID", "Custo"]).appendRow([
    agora, p.projetoId, num(c.maoDeObra),
  ]);

  var sheetManut = obterAba(ABA_MANUTENCAO, ["Data", "ID", "Taxa (R$/h)", "Tempo (h)", "Custo"]);
  var cabManut = lerCabecalho(sheetManut);
  if (String(cabManut[2] || "") === "Taxa (R$/h)") {
    sheetManut.appendRow([
      agora, p.projetoId, num(p.taxaManutencaoHora), horas, num(c.custosFixos),
    ]);
  } else {
    sheetManut.appendRow([agora, p.projetoId, horas, num(c.custosFixos)]);
  }

  ensureSheet(ABA_INSUMOS, ["Data", "ID", "Custo"]).appendRow([
    agora, p.projetoId, num(c.insumos),
  ]);

  return { projetoId: p.projetoId, custoTotal: num(p.custoTotal) };
}

function gravarLinhaProjeto(sheet, agora, p, c, qtd) {
  var formato = detectarFormatoProjetos(lerCabecalho(sheet));
  if (formato === "comResp") {
    sheet.appendRow([
      agora, p.projetoId, qtd, String(p.responsavelProjeto || ""), String(p.impressora || ""),
      p.filamento, num(c.filamento), num(c.energia), num(c.maoDeObra),
      num(c.custosFixos), num(c.insumos), num(p.custoTotal), num(p.custoTotalUnitario),
      num(p.margem), num(p.precoSugerido), num(p.lucroEstimado),
    ]);
    return;
  }
  if (formato === "qtd") {
    sheet.appendRow([
      agora, p.projetoId, qtd, String(p.impressora || ""),
      p.filamento, num(c.filamento), num(c.energia), num(c.maoDeObra),
      num(c.custosFixos), num(c.insumos), num(p.custoTotal), num(p.custoTotalUnitario),
      num(p.margem), num(p.precoSugerido), num(p.lucroEstimado),
    ]);
    return;
  }
  sheet.appendRow([
    agora, p.projetoId, p.filamento, num(c.filamento), num(c.energia), num(c.maoDeObra),
    num(c.custosFixos), num(c.insumos), num(p.custoTotal), num(p.margem),
    num(p.precoSugerido), num(p.lucroEstimado),
  ]);
}

function gravarLinhasFilamento(sheet, agora, projetoId, qtd, fils) {
  var formato = detectarFormatoFilCusto(lerCabecalho(sheet));
  fils.forEach(function (f, idx) {
    var horasFil = round2(num(f.horas));
    var custoLote = round2(num(f.custoUnitario) * qtd);
    if (formato === "slotTempo") {
      sheet.appendRow([
        agora, projetoId, qtd, idx + 1, f.material || "",
        num(f.precoFilamentoKg), num(f.gramas), horasFil, custoLote,
      ]);
    } else if (formato === "slot") {
      sheet.appendRow([
        agora, projetoId, qtd, idx + 1, f.material || "",
        num(f.precoFilamentoKg), num(f.gramas), custoLote,
      ]);
    } else if (formato === "qtd") {
      sheet.appendRow([
        agora, projetoId, qtd, f.material || "",
        num(f.precoFilamentoKg), num(f.gramas), custoLote,
      ]);
    } else {
      sheet.appendRow([
        agora, projetoId, f.material || "",
        num(f.precoFilamentoKg), num(f.gramas), custoLote,
      ]);
    }
  });
}

function gravarVenda(p) {
  var agora = new Date();
  var valorVenda = num(p.valorVenda);
  var custoTotal = num(p.custoTotal);
  var lucro = round2(valorVenda - custoTotal);
  var proj = buscarProjeto(p.projetoId);
  var respProj = p.responsavelProjeto || (proj ? proj.responsavelProjeto : "");

  ensureSheet(ABA_VENDAS, CABECALHO_VENDAS).appendRow([
    agora, p.projetoId, valorVenda, String(p.formaPagamento || ""),
    String(p.responsavelVenda || ""), String(respProj), String(p.observacoes || ""),
    custoTotal, lucro,
  ]);

  return { projetoId: p.projetoId, lucro: lucro };
}

function gravarSaida(p) {
  var agora = new Date();
  ensureSheet(ABA_SAIDAS, CABECALHO_SAIDAS).appendRow([
    agora, String(p.descricao || ""), num(p.valor),
  ]);
  return { descricao: p.descricao, valor: num(p.valor) };
}

function adicionarFilamento(p) {
  var material = String(p.material || "").trim();
  if (!material) throw new Error("Nome do material obrigatório");
  var valor = num(p.valor);
  if (valor <= 0) throw new Error("Valor inválido");
  var sheet = ensureSheet(ABA_FILAMENTOS, ["Material", "Valor", "QTD"]);
  sheet.appendRow([material, valor, 1]);
  return { material: material, valor: valor };
}

function inicializarAbas() {
  var criadas = [];
  var abas = [
    [ABA_FILAMENTOS, ["Material", "Valor", "QTD"]],
    [ABA_PROJETOS, CABECALHO_PROJETOS],
    [ABA_FILAMENTO_CUSTO, CABECALHO_FIL_CUSTO],
    [ABA_ENERGIA, ["Data", "ID", "Impressora", "Consumo (W)", "Tempo (h)", "kWh", "Custo"]],
    [ABA_MAO_DE_OBRA, ["Data", "ID", "Custo"]],
    [ABA_MANUTENCAO, ["Data", "ID", "Taxa (R$/h)", "Tempo (h)", "Custo"]],
    [ABA_INSUMOS, ["Data", "ID", "Custo"]],
    [ABA_VENDAS, CABECALHO_VENDAS],
    [ABA_SAIDAS, CABECALHO_SAIDAS],
  ];
  for (var i = 0; i < abas.length; i++) {
    var sheet = obterAba(abas[i][0], abas[i][1], true);
    if (!sheet) throw new Error("Não foi possível criar a aba: " + abas[i][0]);
    criadas.push(abas[i][0]);
  }
  return criadas;
}

/* -------------------- Utilitários -------------------- */
function planilha() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function ensureSheet(nome, cabecalho) {
  return obterAba(nome, cabecalho, true);
}

function obterAba(nome, cabecalho, criarSeFaltar) {
  if (criarSeFaltar === undefined) criarSeFaltar = true;
  var ss = planilha();
  var matches = [];
  var todas = ss.getSheets();
  for (var i = 0; i < todas.length; i++) {
    if (todas[i].getName() === nome) matches.push(todas[i]);
  }
  var sheet;
  if (matches.length === 0) {
    if (!criarSeFaltar) return null;
    sheet = ss.insertSheet(nome);
  } else {
    sheet = matches[matches.length - 1];
  }
  if (cabecalho && sheet.getLastRow() === 0) {
    sheet.appendRow(cabecalho);
    sheet.getRange(1, 1, 1, cabecalho.length).setFontWeight("bold");
  }
  return sheet;
}

function num(v) {
  var n = Number(v);
  return isNaN(n) ? 0 : n;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
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

function outputJson(obj, e) {
  var text = JSON.stringify(obj);
  var callback = e && e.parameter && e.parameter.callback;
  if (callback) {
    callback = String(callback).replace(/[^\w$.]/g, "");
    if (callback) {
      return ContentService.createTextOutput(callback + "(" + text + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
  }
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}
