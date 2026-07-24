/**
 * TNJ.3D — Backend (Google Apps Script) para o site de gestão/calculadora.
 *
 * Publicação: Implantar › Nova implantação › Tipo "App da Web"
 *   - Executar como: Eu (você)
 *   - Quem tem acesso: Qualquer pessoa
 *
 * GET (JSONP): filamentos, projetos, projetoDetalhe, proximoId, proximoIdReutilizacao,
 *              vendas, saidas, financeiro, caixa, estoque, inicializar, gravar (payload JSON)
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
var ABA_ESTOQUE = "Estoque";
var ABA_CAIXA = "Caixa";
var PREFIXO_PROJETO = "PRJ";
var PREFIXO_VENDA = "VND";

var CABECALHO_PROJETOS = [
  "Data", "ID", "Qtd Peças", "Responsável", "Impressora", "Filamento",
  "Custo Filamento", "Custo Energia", "Mão de Obra", "Custos Fixos", "Insumos",
  "Custo Total", "Custo Unitário", "Margem %", "Preço Sugerido", "Lucro Estimado",
  "Nome Objeto",
];

var CABECALHO_FIL_CUSTO = [
  "Data", "ID", "Qtd Peças", "Slot", "Filamento", "Preço/Kg", "Qtd (g)", "Tempo (h)", "Custo",
];

var CABECALHO_VENDAS = [
  "Data", "ID Projeto", "Valor Venda", "Forma Pagamento", "Responsável Venda",
  "Responsável Projeto", "Observações", "Custo Total", "Lucro", "Qtd Vendida", "Desconto", "ID Venda",
  "Parcelas", "Valor Parcela", "Cartão",
];

var CABECALHO_SAIDAS = ["Data", "Descrição", "Valor", "Tipo", "Pagamento", "Parcelas", "Valor Parcela", "Cartão"];

var CABECALHO_CAIXA = ["Saldo (R$)", "Última atualização"];

var CABECALHO_ESTOQUE = [
  "ID Raiz", "Filamento", "Qtd Estoque", "Preço Ref. (R$)", "Última Atualização",
];

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
  if (action === "caixa") {
    return { ok: true, caixa: lerCaixa() };
  }
  if (action === "estoque") {
    return { ok: true, estoque: lerEstoque() };
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
  if (acao === "definirSaldoCaixa") {
    return { ok: true, resultado: definirSaldoCaixa(dados.saldo) };
  }
  if (acao === "excluirProjeto") {
    return { ok: true, resultado: excluirProjeto(dados.projetoId, dados.data) };
  }
  if (acao === "atualizarProjeto") {
    return { ok: true, resultado: atualizarProjeto(dados) };
  }
  if (acao === "atualizarFilamento") {
    return { ok: true, resultado: atualizarFilamento(dados) };
  }
  if (acao === "excluirFilamento") {
    return { ok: true, resultado: excluirFilamento(dados) };
  }
  if (acao === "alterarStatusFilamento") {
    return { ok: true, resultado: alterarStatusFilamento(dados) };
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
  var sheet = ensureSheet(ABA_FILAMENTOS, ["Material", "Valor", "QTD", "Status"]);
  ensureColunasFilamentos(sheet);
  var valores = sheet.getDataRange().getValues();
  var cab = valores[0] || [];
  var idxStatus = indiceColuna(cab, "Status");
  var lista = [];
  for (var i = 1; i < valores.length; i++) {
    var material = valores[i][0];
    var valor = valores[i][1];
    if (material === "" || material === null) continue;
    var status = idxStatus >= 0 ? String(valores[i][idxStatus] || "").trim() : "";
    var ativo = status !== "Esgotado";
    lista.push({
      linha: i + 1,
      material: String(material),
      valor: Number(valor) || 0,
      qtd: Number(valores[i][2]) || 1,
      status: ativo ? "Ativo" : "Esgotado",
      ativo: ativo,
    });
  }
  return lista;
}

function ensureColunasFilamentos(sheet) {
  var cab = lerCabecalho(sheet);
  if (indiceColuna(cab, "Status") >= 0) return;
  var col = cab.length + 1;
  sheet.getRange(1, col).setValue("Status").setFontWeight("bold");
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

function indiceColuna(cab, nome) {
  if (!cab) return -1;
  for (var i = 0; i < cab.length; i++) {
    if (String(cab[i]).trim() === nome) return i;
  }
  return -1;
}

function indiceColunaNomeObjeto(cab) {
  return indiceColuna(cab, "Nome Objeto");
}

function lerNomeObjetoRow(r, cab) {
  var idx = indiceColunaNomeObjeto(cab);
  return idx >= 0 ? String(r[idx] || "").trim() : "";
}

function ensureColunaNomeObjeto(sheet) {
  var cab = lerCabecalho(sheet);
  var idx = indiceColunaNomeObjeto(cab);
  if (idx >= 0) return idx;
  var col = Math.max(1, cab.length + 1);
  sheet.getRange(1, col).setValue("Nome Objeto").setFontWeight("bold");
  return col - 1;
}

function aplicarNomeObjetoNaLinha(row, idxNome, nome) {
  if (idxNome < 0) return row;
  while (row.length <= idxNome) row.push("");
  row[idxNome] = String(nome || "");
  return row;
}

function buscarNomeObjetoProjeto(projetoId) {
  var proj = buscarProjeto(projetoId);
  if (proj && proj.nomeObjeto) return String(proj.nomeObjeto);
  var raiz = extrairIdRaiz(projetoId);
  var lista = lerProjetos();
  for (var i = lista.length - 1; i >= 0; i--) {
    if (extrairIdRaiz(lista[i].projetoId) !== raiz) continue;
    if (lista[i].nomeObjeto) return String(lista[i].nomeObjeto);
  }
  return "";
}

function lerCabecalho(sheet) {
  if (!sheet || sheet.getLastRow() === 0) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function precoUnitarioFromRow(custoUnit, margem, precoStored, qtd) {
  var cu = Number(custoUnit) || 0;
  var m = Number(margem) || 0;
  var ps = Number(precoStored) || 0;
  var q = Math.max(1, Math.floor(Number(qtd) || 1));
  var fromMargem = round2(cu * (1 + m / 100));
  if (q > 1 && ps > 0 && Math.abs(ps - fromMargem * q) < 0.05) {
    return round2(ps / q);
  }
  return ps > 0 ? round2(ps) : fromMargem;
}

function lerProjetos() {
  var sheet = obterAba(ABA_PROJETOS, null, false);
  if (!sheet) return [];
  var valores = sheet.getDataRange().getValues();
  if (valores.length < 2) return [];
  var formato = detectarFormatoProjetos(valores[0]);
  var cab = valores[0];
  var lista = [];
  for (var i = 1; i < valores.length; i++) {
    var r = valores[i];
    if (!r[1]) continue;
    var nomeObj = lerNomeObjetoRow(r, cab);
    if (formato === "comResp") {
      var qtdResp = Number(r[2]) || 1;
      var custoTotResp = Number(r[11]) || 0;
      var custoUnitResp = Number(r[12]) || round2(custoTotResp / qtdResp);
      var margemResp = Number(r[13]) || 0;
      var precoStoredResp = Number(r[14]) || 0;
      lista.push({
        data: formatarData(r[0]),
        projetoId: String(r[1]),
        quantidadePecas: qtdResp,
        responsavelProjeto: String(r[3] || ""),
        impressora: String(r[4] || ""),
        filamento: String(r[5] || ""),
        custoFilamento: Number(r[6]) || 0,
        custoEnergia: Number(r[7]) || 0,
        maoDeObra: Number(r[8]) || 0,
        custosFixos: Number(r[9]) || 0,
        insumos: Number(r[10]) || 0,
        custoTotal: custoTotResp,
        custoTotalUnitario: custoUnitResp,
        margem: margemResp,
        precoSugerido: precoStoredResp,
        precoSugeridoUnit: precoUnitarioFromRow(custoUnitResp, margemResp, precoStoredResp, qtdResp),
        nomeObjeto: nomeObj,
      });
    } else if (formato === "qtd") {
      var qtdQ = Number(r[2]) || 1;
      var custoTotQ = Number(r[10]) || 0;
      var custoUnitQ = Number(r[11]) || round2(custoTotQ / qtdQ);
      var margemQ = Number(r[12]) || 0;
      var precoStoredQ = Number(r[13]) || 0;
      lista.push({
        data: formatarData(r[0]),
        projetoId: String(r[1]),
        quantidadePecas: qtdQ,
        responsavelProjeto: "",
        impressora: String(r[3] || ""),
        filamento: String(r[4] || ""),
        custoFilamento: Number(r[5]) || 0,
        custoEnergia: Number(r[6]) || 0,
        maoDeObra: Number(r[7]) || 0,
        custosFixos: Number(r[8]) || 0,
        insumos: Number(r[9]) || 0,
        custoTotal: custoTotQ,
        custoTotalUnitario: custoUnitQ,
        margem: margemQ,
        precoSugerido: precoStoredQ,
        precoSugeridoUnit: precoUnitarioFromRow(custoUnitQ, margemQ, precoStoredQ, qtdQ),
        nomeObjeto: nomeObj,
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
        nomeObjeto: nomeObj,
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
    return { row: r, formato: formato, data: r[0], cab: valores[0] };
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
  var cab = encontrado.cab || [];
  var nomeObjeto = lerNomeObjetoRow(r, cab);
  var qtd = 1;
  var responsavel = "";
  var impressora = "";
  var margem = 0;
  var maoObraBatch = 0;
  var insumosBatch = 0;
  var custoFilamento = 0;
  var custoEnergia = 0;
  var custosFixos = 0;
  var filamentoNome = "";
  var precoSugerido = 0;

  if (formato === "comResp") {
    qtd = Number(r[2]) || 1;
    responsavel = String(r[3] || "");
    impressora = String(r[4] || "");
    filamentoNome = String(r[5] || "");
    custoFilamento = Number(r[6]) || 0;
    custoEnergia = Number(r[7]) || 0;
    maoObraBatch = Number(r[8]) || 0;
    custosFixos = Number(r[9]) || 0;
    insumosBatch = Number(r[10]) || 0;
    margem = Number(r[13]) || 0;
    precoSugerido = Number(r[14]) || 0;
  } else if (formato === "qtd") {
    qtd = Number(r[2]) || 1;
    impressora = String(r[3] || "");
    filamentoNome = String(r[4] || "");
    custoFilamento = Number(r[5]) || 0;
    custoEnergia = Number(r[6]) || 0;
    maoObraBatch = Number(r[7]) || 0;
    custosFixos = Number(r[8]) || 0;
    insumosBatch = Number(r[9]) || 0;
    margem = Number(r[12]) || 0;
    precoSugerido = Number(r[13]) || 0;
  } else {
    filamentoNome = String(r[2] || "");
    custoFilamento = Number(r[3]) || 0;
    custoEnergia = Number(r[4]) || 0;
    maoObraBatch = Number(r[5]) || 0;
    custosFixos = Number(r[6]) || 0;
    insumosBatch = Number(r[7]) || 0;
    margem = Number(r[9]) || 0;
    precoSugerido = Number(r[10]) || 0;
  }

  var energia = lerEnergiaRegistro(id, dataReg);
  var manut = lerManutencaoRegistro(id, dataReg);
  var filamentos = lerFilamentosRegistro(id, dataReg);

  if (!filamentos.length && filamentoNome) {
    filamentos.push({
      slot: 1,
      material: filamentoNome,
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
    nomeObjeto: nomeObjeto,
    quantidadePecas: qtd,
    responsavelProjeto: responsavel,
    impressora: energia.impressora || impressora,
    filamento: filamentoNome,
    consumoW: energia.consumoW || 0,
    valorKwh: energia.valorKwh || 0,
    taxaManutencaoHora: manut.taxa || 0,
    maoDeObra: round2(maoObraBatch / qtd),
    insumos: round2(insumosBatch / qtd),
    margem: margem,
    precoSugeridoUnit: round2(precoSugerido / qtd),
    custosUnitarios: {
      filamento: round2(custoFilamento / qtd),
      energia: round2(custoEnergia / qtd),
      maoDeObra: round2(maoObraBatch / qtd),
      custosFixos: round2(custosFixos / qtd),
      insumos: round2(insumosBatch / qtd),
    },
    filamentos: filamentos,
  };
}

function lerVendas() {
  var sheet = obterAba(ABA_VENDAS, null, false);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var valores = sheet.getDataRange().getValues();
  var cab = valores[0] || [];
  var idxDesconto = indiceColuna(cab, "Desconto");
  var idxQtd = indiceColuna(cab, "Qtd Vendida");
  var idxVendaId = indiceColuna(cab, "ID Venda");
  var idxParcelas = indiceColuna(cab, "Parcelas");
  var idxValorParcela = indiceColuna(cab, "Valor Parcela");
  var idxCartao = indiceColuna(cab, "Cartão");
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
      quantidadeVenda: idxQtd >= 0 ? Number(r[idxQtd]) || 1 : 1,
      desconto: idxDesconto >= 0 ? Number(r[idxDesconto]) || 0 : 0,
      vendaId: idxVendaId >= 0 ? String(r[idxVendaId] || "") : "",
      parcelas: idxParcelas >= 0 ? Number(r[idxParcelas]) || 1 : 1,
      valorParcela: idxValorParcela >= 0 ? Number(r[idxValorParcela]) || 0 : 0,
      cartao: idxCartao >= 0 ? String(r[idxCartao] || "") : "",
    });
  }
  return lista.reverse();
}

function lerSaidas() {
  var sheet = obterAba(ABA_SAIDAS, null, false);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var valores = sheet.getDataRange().getValues();
  var cab = valores[0] || [];
  var idxTipo = indiceColuna(cab, "Tipo");
  var idxPag = indiceColuna(cab, "Pagamento");
  var idxParcelas = indiceColuna(cab, "Parcelas");
  var idxValorParcela = indiceColuna(cab, "Valor Parcela");
  var idxCartao = indiceColuna(cab, "Cartão");
  var lista = [];
  for (var i = 1; i < valores.length; i++) {
    var r = valores[i];
    if (!r[1]) continue;
    lista.push({
      data: formatarData(r[0]),
      descricao: String(r[1]),
      valor: Number(r[2]) || 0,
      tipo: idxTipo >= 0 ? String(r[idxTipo] || "Fixo") : "Fixo",
      pagamento: idxPag >= 0 ? String(r[idxPag] || "") : "",
      parcelas: idxParcelas >= 0 ? Number(r[idxParcelas]) || 1 : 1,
      valorParcela: idxValorParcela >= 0 ? Number(r[idxValorParcela]) || 0 : 0,
      cartao: idxCartao >= 0 ? String(r[idxCartao] || "") : "",
    });
  }
  return lista.reverse();
}

function ensureColunasVendas(sheet) {
  var cab = lerCabecalho(sheet);
  var extras = ["Qtd Vendida", "Desconto", "ID Venda", "Parcelas", "Valor Parcela", "Cartão"];
  extras.forEach(function (nome) {
    if (indiceColuna(cab, nome) >= 0) return;
    var col = cab.length + 1;
    sheet.getRange(1, col).setValue(nome).setFontWeight("bold");
    cab.push(nome);
  });
}

function ensureColunasSaidas(sheet) {
  var cab = lerCabecalho(sheet);
  [["Tipo", "Fixo"], ["Pagamento", ""], ["Parcelas", 1], ["Valor Parcela", 0], ["Cartão", ""]].forEach(function (par) {
    if (indiceColuna(cab, par[0]) >= 0) return;
    var col = cab.length + 1;
    sheet.getRange(1, col).setValue(par[0]).setFontWeight("bold");
    cab.push(par[0]);
  });
}

function ensureCaixaSheet() {
  var sheet = ensureSheet(ABA_CAIXA, CABECALHO_CAIXA);
  if (sheet.getLastRow() < 2) {
    sheet.appendRow([0, new Date()]);
  }
  return sheet;
}

function lerSaldoCaixa() {
  var sheet = obterAba(ABA_CAIXA, null, false);
  if (!sheet || sheet.getLastRow() < 2) return 0;
  return Number(sheet.getRange(2, 1).getValue()) || 0;
}

function definirSaldoCaixa(valor) {
  var sheet = ensureCaixaSheet();
  var saldo = round2(num(valor));
  sheet.getRange(2, 1).setValue(saldo);
  sheet.getRange(2, 2).setValue(new Date());
  return { saldo: saldo };
}

function ajustarSaldoCaixa(delta) {
  return definirSaldoCaixa(lerSaldoCaixa() + num(delta));
}

function lerCaixa() {
  return {
    saldo: round2(lerSaldoCaixa()),
    atualizado: formatarData(ensureCaixaSheet().getRange(2, 2).getValue()),
  };
}

function pagamentoEhDinheiro(forma) {
  return String(forma || "").toUpperCase() === "CASH";
}

function lerEstoque() {
  var sheet = obterAba(ABA_ESTOQUE, null, false);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var valores = sheet.getDataRange().getValues();
  var lista = [];
  for (var i = 1; i < valores.length; i++) {
    var r = valores[i];
    if (!r[0]) continue;
    lista.push({
      idRaiz: String(r[0]),
      filamento: String(r[1] || ""),
      qtdEstoque: Number(r[2]) || 0,
      precoRef: Number(r[3]) || 0,
      ultimaAtualizacao: formatarData(r[4]),
      nomeObjeto: buscarNomeObjetoProjeto(String(r[0])),
    });
  }
  return lista;
}

function buscarLinhaEstoque(sheet, idRaiz, filamento) {
  var valores = sheet.getDataRange().getValues();
  var alvoRaiz = String(idRaiz);
  var alvoFil = String(filamento || "");
  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][0]) === alvoRaiz && String(valores[i][1] || "") === alvoFil) {
      return i + 1;
    }
  }
  return -1;
}

function entradaEstoque(idRaiz, filamento, qtd, precoUnit) {
  var sheet = ensureSheet(ABA_ESTOQUE, CABECALHO_ESTOQUE);
  var linha = buscarLinhaEstoque(sheet, idRaiz, filamento);
  var agora = new Date();
  if (linha < 0) {
    sheet.appendRow([idRaiz, filamento, qtd, precoUnit, agora]);
    return { idRaiz: idRaiz, qtdEstoque: qtd };
  }
  var atual = Number(sheet.getRange(linha, 3).getValue()) || 0;
  var novaQtd = atual + qtd;
  sheet.getRange(linha, 3).setValue(novaQtd);
  sheet.getRange(linha, 4).setValue(precoUnit);
  sheet.getRange(linha, 5).setValue(agora);
  return { idRaiz: idRaiz, qtdEstoque: novaQtd };
}

function saidaEstoque(idRaiz, filamento, qtd) {
  var sheet = obterAba(ABA_ESTOQUE, null, false);
  if (!sheet) return { ok: false, error: "Aba Estoque não encontrada" };
  var linha = buscarLinhaEstoque(sheet, idRaiz, filamento);
  if (linha < 0) return { ok: false, error: "Item não encontrado no estoque" };
  var atual = Number(sheet.getRange(linha, 3).getValue()) || 0;
  if (atual < qtd) {
    return { ok: false, error: "Estoque insuficiente (disponível: " + atual + ")" };
  }
  var novaQtd = atual - qtd;
  if (novaQtd <= 0) {
    sheet.deleteRow(linha);
    return { ok: true, idRaiz: idRaiz, qtdEstoque: 0, removido: true };
  }
  sheet.getRange(linha, 3).setValue(novaQtd);
  sheet.getRange(linha, 5).setValue(new Date());
  return { ok: true, idRaiz: idRaiz, qtdEstoque: novaQtd };
}

function reverterEstoqueExclusao(idRaiz, filamento, qtd) {
  var sheet = obterAba(ABA_ESTOQUE, null, false);
  if (!sheet) return { ok: true, skipped: true };
  var linha = buscarLinhaEstoque(sheet, idRaiz, filamento);
  if (linha < 0) return { ok: true, skipped: true };
  return saidaEstoque(idRaiz, filamento, qtd);
}

function calcularFinanceiro() {
  var vendas = lerVendas();
  var saidas = lerSaidas();
  var entradas = 0;
  var custos = 0;
  var lucroVendas = 0;
  var maoDeObra = 0;
  var saidasFixas = 0;
  var saidasProdutos = 0;

  vendas.forEach(function (v) {
    entradas += v.valorVenda;
    custos += v.custoTotal;
    lucroVendas += v.lucro;
    var proj = buscarProjeto(v.projetoId);
    if (proj) maoDeObra += proj.maoDeObra;
  });

  saidas.forEach(function (s) {
    if (String(s.tipo) === "Produto") {
      saidasProdutos += s.valor;
    } else {
      saidasFixas += s.valor;
    }
  });

  var totalSaidas = saidasFixas + saidasProdutos;

  return {
    entradas: round2(entradas),
    saidas: round2(totalSaidas),
    saidasFixas: round2(saidasFixas),
    saidasProdutos: round2(saidasProdutos),
    custos: round2(custos),
    lucro: round2(lucroVendas - totalSaidas),
    maoDeObra: round2(maoDeObra),
    caixa: round2(lerSaldoCaixa()),
  };
}

function buscarProjeto(projetoId) {
  var lista = lerProjetos();
  for (var i = 0; i < lista.length; i++) {
    if (lista[i].projetoId === projetoId) return lista[i];
  }
  return null;
}

function projetoTemVenda(projetoId) {
  var vendas = lerVendas();
  var alvo = String(projetoId);
  for (var i = 0; i < vendas.length; i++) {
    if (vendas[i].projetoId === alvo) return true;
  }
  return false;
}

function removerLinhasPorProjeto(sheet, projetoId, dataRef) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var valores = sheet.getDataRange().getValues();
  var removidas = 0;
  for (var i = valores.length - 1; i >= 1; i--) {
    var row = valores[i];
    if (String(row[1]) !== String(projetoId)) continue;
    if (!datasCompativeis(row[0], dataRef)) continue;
    sheet.deleteRow(i + 1);
    removidas++;
  }
  return removidas;
}

function extrairQtdFilamentoProjeto(encontrado) {
  var r = encontrado.row;
  var formato = encontrado.formato;
  var qtd = 1;
  var filamento = "";
  if (formato === "comResp") {
    qtd = Number(r[2]) || 1;
    filamento = String(r[5] || "");
  } else if (formato === "qtd") {
    qtd = Number(r[2]) || 1;
    filamento = String(r[4] || "");
  } else {
    filamento = String(r[2] || "");
  }
  return { qtd: qtd, filamento: filamento };
}

function excluirProjeto(projetoId, dataRef) {
  var id = String(projetoId || "").trim();
  if (!id) throw new Error("ID do projeto obrigatório");
  if (!dataRef) throw new Error("Data do registro obrigatória");

  var encontrado = buscarLinhaProjeto(id, dataRef);
  if (!encontrado) throw new Error("Projeto não encontrado: " + id);

  if (projetoTemVenda(id)) {
    throw new Error("Projeto já vendido; exclusão bloqueada.");
  }

  var info = extrairQtdFilamentoProjeto(encontrado);
  var estoqueResult = reverterEstoqueExclusao(extrairIdRaiz(id), info.filamento, info.qtd);
  if (!estoqueResult.ok) {
    throw new Error("Não foi possível ajustar o estoque: " + (estoqueResult.error || "erro"));
  }

  var abas = [
    ABA_PROJETOS,
    ABA_FILAMENTO_CUSTO,
    ABA_ENERGIA,
    ABA_MAO_DE_OBRA,
    ABA_MANUTENCAO,
    ABA_INSUMOS,
  ];
  var totalRemovidas = 0;
  abas.forEach(function (nome) {
    var sheet = obterAba(nome, null, false);
    totalRemovidas += removerLinhasPorProjeto(sheet, id, dataRef);
  });

  return { projetoId: id, linhasRemovidas: totalRemovidas };
}

function buscarIndicesLinhasPorProjeto(sheet, projetoId, dataRef) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  var valores = sheet.getDataRange().getValues();
  var indices = [];
  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][1]) !== String(projetoId)) continue;
    if (!datasCompativeis(valores[i][0], dataRef)) continue;
    indices.push(i + 1);
  }
  return indices;
}

function atualizarCamposRelacionadosProjeto(projetoId, dataRef, campos) {
  var sheetEn = obterAba(ABA_ENERGIA, null, false);
  if (sheetEn) {
    buscarIndicesLinhasPorProjeto(sheetEn, projetoId, dataRef).forEach(function (linha) {
      sheetEn.getRange(linha, 3).setValue(campos.impressora);
    });
  }

  var sheetFil = obterAba(ABA_FILAMENTO_CUSTO, null, false);
  if (sheetFil) {
    var cabFil = lerCabecalho(sheetFil);
    var formatoFil = detectarFormatoFilCusto(cabFil);
    buscarIndicesLinhasPorProjeto(sheetFil, projetoId, dataRef).forEach(function (linha) {
      if (formatoFil === "slotTempo" || formatoFil === "slot" || formatoFil === "qtd") {
        sheetFil.getRange(linha, 3).setValue(campos.qtd);
      }
      if (formatoFil === "slotTempo") {
        sheetFil.getRange(linha, 5).setValue(campos.filamento);
      } else if (formatoFil === "slot") {
        sheetFil.getRange(linha, 5).setValue(campos.filamento);
      } else if (formatoFil === "qtd") {
        sheetFil.getRange(linha, 4).setValue(campos.filamento);
      } else {
        sheetFil.getRange(linha, 3).setValue(campos.filamento);
      }
    });
  }

  var sheetVendas = obterAba(ABA_VENDAS, null, false);
  if (sheetVendas) {
    var cabV = lerCabecalho(sheetVendas);
    var idxResp = indiceColuna(cabV, "Responsável Projeto");
    var idxProj = indiceColuna(cabV, "ID Projeto");
    if (idxProj < 0) idxProj = 1;
    if (idxResp < 0) idxResp = 5;
    var valoresV = sheetVendas.getDataRange().getValues();
    for (var j = 1; j < valoresV.length; j++) {
      if (String(valoresV[j][idxProj]) !== String(projetoId)) continue;
      sheetVendas.getRange(j + 1, idxResp + 1).setValue(campos.responsavelProjeto);
    }
  }
}

function atualizarProjeto(dados) {
  var id = String(dados.projetoId || "").trim();
  var dataRef = dados.data;
  if (!id) throw new Error("ID do projeto obrigatório");
  if (!dataRef) throw new Error("Data do registro obrigatória");

  var sheet = obterAba(ABA_PROJETOS, null, false);
  if (!sheet) throw new Error("Aba Projetos não encontrada");

  var indices = buscarIndicesLinhasPorProjeto(sheet, id, dataRef);
  if (!indices.length) throw new Error("Projeto não encontrado: " + id);

  var linha = indices[0];
  var cab = lerCabecalho(sheet);
  var formato = detectarFormatoProjetos(cab);
  var qtd = Math.max(1, Math.floor(num(dados.quantidadePecas) || 1));
  var nome = String(dados.nomeObjeto || "");
  var resp = String(dados.responsavelProjeto || "");
  var impressora = String(dados.impressora || "");
  var filamento = String(dados.filamento || "");

  if (formato === "comResp") {
    sheet.getRange(linha, 3).setValue(qtd);
    sheet.getRange(linha, 4).setValue(resp);
    sheet.getRange(linha, 5).setValue(impressora);
    sheet.getRange(linha, 6).setValue(filamento);
  } else if (formato === "qtd") {
    sheet.getRange(linha, 3).setValue(qtd);
    sheet.getRange(linha, 4).setValue(impressora);
    sheet.getRange(linha, 5).setValue(filamento);
  } else {
    sheet.getRange(linha, 3).setValue(filamento);
  }

  var idxNome = ensureColunaNomeObjeto(sheet);
  sheet.getRange(linha, idxNome + 1).setValue(nome);

  atualizarCamposRelacionadosProjeto(id, dataRef, {
    qtd: qtd,
    impressora: impressora,
    filamento: filamento,
    responsavelProjeto: resp,
  });

  return { projetoId: id, atualizado: true };
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

  var precoUnit = round2(num(p.precoSugerido));
  entradaEstoque(extrairIdRaiz(p.projetoId), String(p.filamento || ""), qtd, precoUnit);

  return { projetoId: p.projetoId, custoTotal: num(p.custoTotal) };
}

function gravarLinhaProjeto(sheet, agora, p, c, qtd) {
  var formato = detectarFormatoProjetos(lerCabecalho(sheet));
  var idxNome = ensureColunaNomeObjeto(sheet);
  var nome = String(p.nomeObjeto || "");
  if (formato === "comResp") {
    var rowResp = [
      agora, p.projetoId, qtd, String(p.responsavelProjeto || ""), String(p.impressora || ""),
      p.filamento, num(c.filamento), num(c.energia), num(c.maoDeObra),
      num(c.custosFixos), num(c.insumos), num(p.custoTotal), num(p.custoTotalUnitario),
      num(p.margem), num(p.precoSugerido), num(p.lucroEstimado),
    ];
    sheet.appendRow(aplicarNomeObjetoNaLinha(rowResp, idxNome, nome));
    return;
  }
  if (formato === "qtd") {
    var rowQtd = [
      agora, p.projetoId, qtd, String(p.impressora || ""),
      p.filamento, num(c.filamento), num(c.energia), num(c.maoDeObra),
      num(c.custosFixos), num(c.insumos), num(p.custoTotal), num(p.custoTotalUnitario),
      num(p.margem), num(p.precoSugerido), num(p.lucroEstimado),
    ];
    sheet.appendRow(aplicarNomeObjetoNaLinha(rowQtd, idxNome, nome));
    return;
  }
  var rowAnt = [
    agora, p.projetoId, p.filamento, num(c.filamento), num(c.energia), num(c.maoDeObra),
    num(c.custosFixos), num(c.insumos), num(p.custoTotal), num(p.margem),
    num(p.precoSugerido), num(p.lucroEstimado),
  ];
  sheet.appendRow(aplicarNomeObjetoNaLinha(rowAnt, idxNome, nome));
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

function proximoIdVenda() {
  var hoje = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd");
  var sheet = obterAba(ABA_VENDAS, null, false);
  var prefixo = PREFIXO_VENDA + "-" + hoje + "-";
  var seq = 1;
  if (sheet && sheet.getLastRow() > 1) {
    var cab = lerCabecalho(sheet);
    var idxVendaId = indiceColuna(cab, "ID Venda");
    var valores = sheet.getDataRange().getValues();
    for (var i = 1; i < valores.length; i++) {
      var id = idxVendaId >= 0 ? String(valores[i][idxVendaId] || "") : "";
      if (id.indexOf(prefixo) === 0) {
        var n = parseInt(id.replace(prefixo, ""), 10);
        if (!isNaN(n) && n >= seq) seq = n + 1;
      }
    }
  }
  return prefixo + String(seq).padStart(3, "0");
}

function gravarVenda(p) {
  if (p.itens && p.itens.length) {
    return gravarVendaMultipla(p);
  }
  var vendaId = p.vendaId || proximoIdVenda();
  var item = gravarVendaItem(p, vendaId, num(p.desconto));
  if (pagamentoEhDinheiro(p.formaPagamento)) {
    ajustarSaldoCaixa(item.valorVenda);
  }
  return { vendaId: vendaId, itens: [item] };
}

function detalhesCartaoPayload(p, valorRef) {
  var forma = String(p.formaPagamento || p.pagamento || "");
  if (!pagamentoEhCartao(forma)) {
    return { parcelas: 1, valorParcela: num(valorRef), cartao: "" };
  }
  var parcelas = pagamentoEhCartaoCredito(forma)
    ? Math.max(1, Math.min(12, Math.floor(num(p.parcelas) || 1)))
    : 1;
  var total = Math.max(0, num(valorRef));
  var valorParcela = round2(total / parcelas);
  return {
    parcelas: parcelas,
    valorParcela: num(p.valorParcela) > 0 ? round2(num(p.valorParcela)) : valorParcela,
    cartao: String(p.cartao || "").trim(),
  };
}

function pagamentoEhCartao(forma) {
  var f = String(forma || "").toUpperCase();
  return f === "CC" || f === "CD";
}

function pagamentoEhCartaoCredito(forma) {
  return String(forma || "").toUpperCase() === "CC";
}

function gravarVendaMultipla(p) {
  var vendaId = proximoIdVenda();
  var forma = String(p.formaPagamento || "");
  var descontoTotal = Math.max(0, num(p.desconto));
  var itensPayload = p.itens || [];
  var brutoTotal = 0;
  itensPayload.forEach(function (item) {
    var qtd = Math.max(1, Math.floor(num(item.quantidadeVenda) || 1));
    var precoUnit = num(item.valorUnitario) || num(item.valorVenda);
    brutoTotal += precoUnit * qtd;
  });
  var liquidoTotal = Math.max(0, brutoTotal - descontoTotal);
  var cartaoInfo = detalhesCartaoPayload(p, liquidoTotal);
  var fator = brutoTotal > 0 ? liquidoTotal / brutoTotal : 1;
  var resultados = [];
  var totalCash = 0;
  itensPayload.forEach(function (item, idx) {
    var qtd = Math.max(1, Math.floor(num(item.quantidadeVenda) || 1));
    var precoUnit = num(item.valorUnitario) || 0;
    var bruto = precoUnit * qtd;
    var valorItem = round2(bruto * fator);
    var descontoItem = idx === 0 ? descontoTotal : 0;
    var r = gravarVendaItem({
      projetoId: item.projetoId,
      valorVenda: valorItem,
      quantidadeVenda: qtd,
      formaPagamento: forma,
      responsavelVenda: p.responsavelVenda,
      observacoes: p.observacoes,
      custoTotal: num(item.custoTotal),
      responsavelProjeto: item.responsavelProjeto,
      parcelas: cartaoInfo.parcelas,
      valorParcela: cartaoInfo.valorParcela,
      cartao: cartaoInfo.cartao,
    }, vendaId, descontoItem);
    resultados.push(r);
    totalCash += valorItem;
  });
  if (pagamentoEhDinheiro(forma) && totalCash > 0) {
    ajustarSaldoCaixa(totalCash);
  }
  return { vendaId: vendaId, itens: resultados };
}

function gravarVendaItem(p, vendaId, descontoLinha) {
  var agora = new Date();
  var valorVenda = num(p.valorVenda);
  var custoTotal = num(p.custoTotal);
  var qtdVenda = Math.max(1, Math.floor(num(p.quantidadeVenda) || 1));
  var desconto = Math.max(0, num(descontoLinha));
  var lucro = round2(valorVenda - custoTotal);
  var proj = buscarProjeto(p.projetoId);
  var respProj = p.responsavelProjeto || (proj ? proj.responsavelProjeto : "");
  var filamento = proj ? proj.filamento : "";
  var cartaoInfo = detalhesCartaoPayload(p, valorVenda);

  var estoque = saidaEstoque(extrairIdRaiz(p.projetoId), filamento, qtdVenda);
  if (estoque && estoque.ok === false) {
    throw new Error(estoque.error || "Falha ao baixar estoque");
  }

  var sheetVendas = ensureSheet(ABA_VENDAS, CABECALHO_VENDAS);
  ensureColunasVendas(sheetVendas);
  var cabV = lerCabecalho(sheetVendas);
  var dados = {
    "Data": agora,
    "ID Projeto": p.projetoId,
    "Valor Venda": valorVenda,
    "Forma Pagamento": String(p.formaPagamento || ""),
    "Responsável Venda": String(p.responsavelVenda || ""),
    "Responsável Projeto": String(respProj),
    "Observações": String(p.observacoes || ""),
    "Custo Total": custoTotal,
    "Lucro": lucro,
    "Qtd Vendida": qtdVenda,
    "Desconto": desconto,
    "ID Venda": String(vendaId || ""),
    "Parcelas": cartaoInfo.parcelas,
    "Valor Parcela": cartaoInfo.valorParcela,
    "Cartão": cartaoInfo.cartao,
  };
  sheetVendas.appendRow(montarLinhaPorCabecalho(cabV, dados));

  return {
    projetoId: p.projetoId,
    valorVenda: valorVenda,
    lucro: lucro,
    qtdEstoque: estoque.qtdEstoque,
    vendaId: vendaId,
  };
}

function montarLinhaPorCabecalho(cab, dados) {
  var row = [];
  for (var i = 0; i < cab.length; i++) {
    var h = String(cab[i]).trim();
    row.push(dados.hasOwnProperty(h) ? dados[h] : "");
  }
  return row;
}

function gravarSaida(p) {
  var agora = new Date();
  var valor = num(p.valor);
  var tipo = String(p.tipo || "Fixo");
  var pagamento = String(p.pagamento || "");
  var sheet = ensureSheet(ABA_SAIDAS, CABECALHO_SAIDAS);
  ensureColunasSaidas(sheet);
  var cab = lerCabecalho(sheet);
  var cartaoInfo = detalhesCartaoPayload(p, valor);
  var dados = {
    "Data": agora,
    "Descrição": String(p.descricao || ""),
    "Valor": valor,
    "Tipo": tipo,
    "Pagamento": pagamento,
    "Parcelas": cartaoInfo.parcelas,
    "Valor Parcela": cartaoInfo.valorParcela,
    "Cartão": cartaoInfo.cartao,
  };
  sheet.appendRow(montarLinhaPorCabecalho(cab, dados));
  if (pagamentoEhDinheiro(pagamento)) {
    ajustarSaldoCaixa(-valor);
  }
  return { descricao: p.descricao, valor: valor, tipo: tipo };
}

function adicionarFilamento(p) {
  var material = String(p.material || "").trim();
  if (!material) throw new Error("Nome do material obrigatório");
  var valor = num(p.valor);
  if (valor <= 0) throw new Error("Valor inválido");
  var sheet = ensureSheet(ABA_FILAMENTOS, ["Material", "Valor", "QTD", "Status"]);
  ensureColunasFilamentos(sheet);
  var cab = lerCabecalho(sheet);
  var dados = {
    "Material": material,
    "Valor": valor,
    "QTD": 1,
    "Status": "Ativo",
  };
  sheet.appendRow(montarLinhaPorCabecalho(cab, dados));
  return { material: material, valor: valor, status: "Ativo", ativo: true };
}

function atualizarFilamento(p) {
  var linha = Math.floor(num(p.linha));
  if (linha < 2) throw new Error("Linha inválida");
  var material = String(p.material || "").trim();
  if (!material) throw new Error("Nome do material obrigatório");
  var valor = num(p.valor);
  if (valor <= 0) throw new Error("Valor inválido");
  var sheet = obterAba(ABA_FILAMENTOS, null, false);
  if (!sheet || linha > sheet.getLastRow()) throw new Error("Filamento não encontrado");
  sheet.getRange(linha, 1).setValue(material);
  sheet.getRange(linha, 2).setValue(valor);
  return { linha: linha, material: material, valor: valor };
}

function excluirFilamento(p) {
  var linha = Math.floor(num(p.linha));
  if (linha < 2) throw new Error("Linha inválida");
  var sheet = obterAba(ABA_FILAMENTOS, null, false);
  if (!sheet || linha > sheet.getLastRow()) throw new Error("Filamento não encontrado");
  var material = String(sheet.getRange(linha, 1).getValue() || "");
  sheet.deleteRow(linha);
  return { linha: linha, material: material };
}

function alterarStatusFilamento(p) {
  var linha = Math.floor(num(p.linha));
  if (linha < 2) throw new Error("Linha inválida");
  var esgotado = p.esgotado === true || String(p.status || "").toLowerCase() === "esgotado";
  var sheet = ensureSheet(ABA_FILAMENTOS, ["Material", "Valor", "QTD", "Status"]);
  ensureColunasFilamentos(sheet);
  var cab = lerCabecalho(sheet);
  var idxStatus = indiceColuna(cab, "Status");
  if (idxStatus < 0) throw new Error("Coluna Status ausente");
  if (linha > sheet.getLastRow()) throw new Error("Filamento não encontrado");
  var status = esgotado ? "Esgotado" : "Ativo";
  sheet.getRange(linha, idxStatus + 1).setValue(status);
  return { linha: linha, status: status, ativo: !esgotado };
}

function inicializarAbas() {
  var criadas = [];
  var abas = [
    [ABA_FILAMENTOS, ["Material", "Valor", "QTD", "Status"]],
    [ABA_PROJETOS, CABECALHO_PROJETOS],
    [ABA_FILAMENTO_CUSTO, CABECALHO_FIL_CUSTO],
    [ABA_ENERGIA, ["Data", "ID", "Impressora", "Consumo (W)", "Tempo (h)", "kWh", "Custo"]],
    [ABA_MAO_DE_OBRA, ["Data", "ID", "Custo"]],
    [ABA_MANUTENCAO, ["Data", "ID", "Taxa (R$/h)", "Tempo (h)", "Custo"]],
    [ABA_INSUMOS, ["Data", "ID", "Custo"]],
    [ABA_VENDAS, CABECALHO_VENDAS],
    [ABA_SAIDAS, CABECALHO_SAIDAS],
    [ABA_ESTOQUE, CABECALHO_ESTOQUE],
    [ABA_CAIXA, CABECALHO_CAIXA],
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
