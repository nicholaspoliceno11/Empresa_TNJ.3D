/**
 * PAINEL DE CAMPANHA — Backend (Google Apps Script)
 * Conecta ao Supabase (projeto eleicao-2026) via API REST + Auth.
 *
 * CONFIGURAÇÃO NECESSÁRIA (antes de usar):
 * 1. Abra "Configurações do projeto" no editor do Apps Script.
 * 2. Em "Propriedades do script", adicione:
 *      SUPABASE_URL  = https://nqosjndnfwnojlldybqg.supabase.co
 *      SUPABASE_KEY  = sua chave publicável (sb_publishable_...)
 *      SUPABASE_SERVICE_KEY = chave secreta (sb_secret_...) — só para admin
 */

function getConfig_() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('SUPABASE_URL');
  var key = props.getProperty('SUPABASE_KEY');
  if (!url || !key) {
    throw new Error('Configure SUPABASE_URL e SUPABASE_KEY em Propriedades do script.');
  }
  return { url: url, key: key };
}

/** Serve o app web. Necessário para publicar como Web App. */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Painel de Campanha')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Permite incluir arquivos HTML parciais (CSS/JS/templates). */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// --------------------------------------------------------------------
// AUTENTICAÇÃO
// --------------------------------------------------------------------

function login(email, senha) {
  var cfg = getConfig_();
  var response = UrlFetchApp.fetch(cfg.url + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    contentType: 'application/json',
    headers: { apikey: cfg.key },
    payload: JSON.stringify({ email: email, password: senha }),
    muteHttpExceptions: true
  });
  var code = response.getResponseCode();
  var data = JSON.parse(response.getContentText());

  if (code >= 400) {
    throw new Error(data.error_description || data.msg || 'E-mail ou senha inválidos.');
  }

  var accessToken = data.access_token;
  var usuario = data.user;
  var perfilResp = supabaseRequestComToken_(
    accessToken,
    'GET',
    'perfis_usuario?select=nome,perfil,ativo&user_id=eq.' + usuario.id
  );

  if (!perfilResp || perfilResp.length === 0 || !perfilResp[0].ativo) {
    throw new Error('Este usuário não tem um perfil de acesso ativo. Contate o administrador.');
  }

  registrarLog_(accessToken, 'Login', null);
  return {
    accessToken: accessToken,
    email: usuario.email,
    nome: perfilResp[0].nome,
    perfil: perfilResp[0].perfil
  };
}

function revalidarSessao(accessToken) {
  var userId = getUserIdDoToken_(accessToken);
  var perfilResp = supabaseRequestComToken_(
    accessToken,
    'GET',
    'perfis_usuario?select=nome,perfil,ativo,user_id&user_id=eq.' + userId
  );
  if (!perfilResp || perfilResp.length === 0 || !perfilResp[0].ativo) {
    throw new Error('Sessão inválida ou perfil inativo.');
  }
  return { nome: perfilResp[0].nome, perfil: perfilResp[0].perfil };
}

// --------------------------------------------------------------------
// HELPER — API REST DO SUPABASE (PostgREST)
// --------------------------------------------------------------------

function supabaseRequestComToken_(accessToken, method, path, body) {
  var cfg = getConfig_();
  if (!accessToken) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }
  var options = {
    method: method,
    contentType: 'application/json',
    headers: {
      apikey: cfg.key,
      Authorization: 'Bearer ' + accessToken,
      Prefer: method === 'POST' || method === 'PATCH' ? 'return=representation' : ''
    },
    muteHttpExceptions: true
  };
  if (body) {
    options.payload = JSON.stringify(body);
  }
  var response = UrlFetchApp.fetch(cfg.url + '/rest/v1/' + path, options);
  var code = response.getResponseCode();
  var text = response.getContentText();
  if (code >= 400) {
    var msg = text;
    try { msg = JSON.parse(text).message || text; } catch (e) {}
    throw new Error('Erro Supabase (' + code + '): ' + msg);
  }
  return text ? JSON.parse(text) : null;
}

// --------------------------------------------------------------------
// FINANCEIRO
// --------------------------------------------------------------------

function getFinanceiro(token) {
  return supabaseRequestComToken_(
    token,
    'GET',
    'financeiro?select=*,centros_custo(id,codigo,categoria,observacao_fonte),fontes_recurso(id,codigo,nome),coordenacoes(id,codigo,nome)&order=data.desc'
  );
}

function getFontesRecurso(token) {
  return supabaseRequestComToken_(token, 'GET', 'fontes_recurso?select=*&order=codigo.asc');
}

function getCentrosCusto(token) {
  return supabaseRequestComToken_(
    token,
    'GET',
    'centros_custo?select=*,centro_custo_fonte(fonte_recurso_id)&order=codigo.asc'
  );
}

function getPessoas(token) {
  return supabaseRequestComToken_(token, 'GET', 'pessoas?select=*&order=nome.asc');
}

function salvarPessoa(token, registro) {
  if (registro.id) {
    var id = registro.id;
    delete registro.id;
    var respPatch = supabaseRequestComToken_(token, 'PATCH', 'pessoas?id=eq.' + id, registro);
    registrarLog_(token, 'Editar', 'Pessoa: ' + (registro.nome || id));
    return respPatch;
  }
  var respPost = supabaseRequestComToken_(token, 'POST', 'pessoas', registro);
  registrarLog_(token, 'Criar', 'Pessoa: ' + registro.nome);
  return respPost;
}

function excluirPessoa(token, id) {
  var resp = supabaseRequestComToken_(token, 'DELETE', 'pessoas?id=eq.' + id, null);
  registrarLog_(token, 'Excluir', 'Pessoa: registro ' + id);
  return resp;
}

function getCoordenacoes(token) {
  return supabaseRequestComToken_(token, 'GET', 'coordenacoes?select=*&order=codigo.asc');
}

function getSubregioesMaceio(token) {
  return supabaseRequestComToken_(token, 'GET', 'subregioes_maceio?select=*&order=id_subregiao.asc');
}

function salvarFinanceiro(token, registro) {
  var descricaoLog = registro.tipo + ' de ' + registro.valor +
    (registro.fornecedor ? ' — fornecedor ' + registro.fornecedor : '') +
    (registro.responsavel_pagamento ? ' (pagto: ' + registro.responsavel_pagamento + ')' : '') +
    (registro.responsavel_recebimento ? ' (receb.: ' + registro.responsavel_recebimento + ')' : '');

  if (registro.id) {
    var idFin = registro.id;
    delete registro.id;
    var respFinPatch = supabaseRequestComToken_(token, 'PATCH', 'financeiro?id=eq.' + idFin, registro);
    registrarLog_(token, 'Editar', 'Financeiro: ' + descricaoLog);
    return respFinPatch;
  }
  var respFinPost = supabaseRequestComToken_(token, 'POST', 'financeiro', registro);
  registrarLog_(token, 'Criar', 'Financeiro: ' + descricaoLog);
  return respFinPost;
}

function excluirFinanceiro(token, id) {
  var resp = supabaseRequestComToken_(token, 'DELETE', 'financeiro?id=eq.' + id, null);
  registrarLog_(token, 'Excluir', 'Financeiro: registro ' + id);
  return resp;
}

// --------------------------------------------------------------------
// AGENDA
// --------------------------------------------------------------------

function getAgenda(token) {
  return supabaseRequestComToken_(token, 'GET', 'agenda?select=*&order=data_inicio.asc');
}

function salvarAgenda(token, registro) {
  if (registro.id) {
    var idAg = registro.id;
    delete registro.id;
    var respAgPatch = supabaseRequestComToken_(token, 'PATCH', 'agenda?id=eq.' + idAg, registro);
    registrarLog_(token, 'Editar', 'Agenda: ' + (registro.titulo || idAg));
    return respAgPatch;
  }
  var respAgPost = supabaseRequestComToken_(token, 'POST', 'agenda', registro);
  registrarLog_(token, 'Criar', 'Agenda: ' + registro.titulo);
  return respAgPost;
}

function excluirAgenda(token, id) {
  var resp = supabaseRequestComToken_(token, 'DELETE', 'agenda?id=eq.' + id, null);
  registrarLog_(token, 'Excluir', 'Agenda: registro ' + id);
  return resp;
}

// --------------------------------------------------------------------
// KANBAN
// --------------------------------------------------------------------

function getKanban(token) {
  return supabaseRequestComToken_(token, 'GET', 'kanban_tarefas?select=*&order=criado_em.desc');
}

function salvarKanban(token, registro) {
  registro.atualizado_em = new Date().toISOString();
  if (registro.id) {
    var idKb = registro.id;
    delete registro.id;
    var respKbPatch = supabaseRequestComToken_(token, 'PATCH', 'kanban_tarefas?id=eq.' + idKb, registro);
    registrarLog_(token, 'Editar', 'Kanban: ' + (registro.titulo || idKb));
    return respKbPatch;
  }
  var respKbPost = supabaseRequestComToken_(token, 'POST', 'kanban_tarefas', registro);
  registrarLog_(token, 'Criar', 'Kanban: ' + registro.titulo);
  return respKbPost;
}

function atualizarStatusKanban(token, id, novoStatus) {
  var resp = supabaseRequestComToken_(token, 'PATCH', 'kanban_tarefas?id=eq.' + id, {
    status: novoStatus,
    atualizado_em: new Date().toISOString()
  });
  registrarLog_(token, 'Editar', 'Kanban: status alterado para "' + novoStatus + '" (registro ' + id + ')');
  return resp;
}

function excluirKanban(token, id) {
  var resp = supabaseRequestComToken_(token, 'DELETE', 'kanban_tarefas?id=eq.' + id, null);
  registrarLog_(token, 'Excluir', 'Kanban: registro ' + id);
  return resp;
}

// --------------------------------------------------------------------
// ZONAS ELEITORAIS / MUNICÍPIOS
// --------------------------------------------------------------------

function getMunicipios(token) {
  return supabaseRequestComToken_(
    token,
    'GET',
    'municipios?select=municipio,regiao,eleitorado_2024,votantes_2024,abstencoes_2024,prefeito_atual,partido_atual,alinhamento_1,status,score,nivel_risco,zona_eleitoral&order=municipio.asc'
  );
}

// --------------------------------------------------------------------
// LÍDERES E QGs POR BAIRRO
// --------------------------------------------------------------------

function getQgs(token) {
  return supabaseRequestComToken_(token, 'GET', 'qgs_bairros?select=*&order=municipio.asc,bairro.asc');
}

function salvarQg(token, registro) {
  if (registro.id) {
    var idQg = registro.id;
    delete registro.id;
    var respQgPatch = supabaseRequestComToken_(token, 'PATCH', 'qgs_bairros?id=eq.' + idQg, registro);
    registrarLog_(token, 'Editar', 'QG: ' + (registro.bairro || idQg));
    return respQgPatch;
  }
  var respQgPost = supabaseRequestComToken_(token, 'POST', 'qgs_bairros', registro);
  registrarLog_(token, 'Criar', 'QG: ' + registro.bairro + ' (' + (registro.municipio || '—') + ')');
  return respQgPost;
}

function excluirQg(token, id) {
  var resp = supabaseRequestComToken_(token, 'DELETE', 'qgs_bairros?id=eq.' + id, null);
  registrarLog_(token, 'Excluir', 'QG: registro ' + id);
  return resp;
}

// --------------------------------------------------------------------
// PAINEL GERAL — KPIs e gráficos
// --------------------------------------------------------------------

function getResumoPainel(token) {
  var financeiro = getFinanceiro(token);
  var agenda = getAgenda(token);
  var kanban = getKanban(token);
  var municipios = getMunicipios(token);
  var qgs = getQgs(token);
  var fontesRecurso = getFontesRecurso(token);
  var centrosCusto = getCentrosCusto(token);
  var subregioesMaceio = getSubregioesMaceio(token);
  var pessoas = getPessoas(token);
  var coordenacoes = getCoordenacoes(token);

  var totalEntradas = 0;
  var totalSaidas = 0;
  financeiro.forEach(function (f) {
    if (f.tipo === 'Entrada') totalEntradas += Number(f.valor);
    else totalSaidas += Number(f.valor);
  });

  var kanbanPorStatus = { Pendente: 0, Andamento: 0, 'Concluído': 0 };
  kanban.forEach(function (t) {
    kanbanPorStatus[t.status] = (kanbanPorStatus[t.status] || 0) + 1;
  });

  var hoje = new Date();
  var proximosEventos = agenda.filter(function (e) {
    return new Date(e.data_inicio) >= hoje && e.status === 'Agendado';
  }).length;

  return {
    totalEntradas: totalEntradas,
    totalSaidas: totalSaidas,
    saldo: totalEntradas - totalSaidas,
    kanbanPorStatus: kanbanPorStatus,
    totalTarefas: kanban.length,
    proximosEventos: proximosEventos,
    totalMunicipios: municipios.length,
    financeiro: financeiro,
    agenda: agenda,
    kanban: kanban,
    municipios: municipios,
    qgs: qgs,
    fontesRecurso: fontesRecurso,
    centrosCusto: centrosCusto,
    pessoas: pessoas,
    coordenacoes: coordenacoes,
    subregioesMaceio: subregioesMaceio
  };
}

// --------------------------------------------------------------------
// ADMINISTRAÇÃO DE USUÁRIOS (Gerenciador / TI)
// --------------------------------------------------------------------

function getServiceKey_() {
  var key = PropertiesService.getScriptProperties().getProperty('SUPABASE_SERVICE_KEY');
  if (!key) {
    throw new Error('Configure SUPABASE_SERVICE_KEY em Propriedades do script.');
  }
  return key;
}

function verificarAdmin_(token) {
  var perfilResp = supabaseRequestComToken_(
    token,
    'GET',
    'perfis_usuario?select=perfil&user_id=eq.' + getUserIdDoToken_(token)
  );
  var perfil = perfilResp && perfilResp[0] ? perfilResp[0].perfil : null;
  if (perfil !== 'Gerenciador' && perfil !== 'TI') {
    throw new Error('Apenas Gerenciador ou TI podem gerenciar usuários.');
  }
}

// --------------------------------------------------------------------
// AUDITORIA
// --------------------------------------------------------------------

function registrarLog_(token, acao, detalhes) {
  try {
    var userId = getUserIdDoToken_(token);
    var perfilResp = supabaseRequestComToken_(
      token,
      'GET',
      'perfis_usuario?select=nome,email,perfil&user_id=eq.' + userId
    );
    var info = perfilResp && perfilResp[0] ? perfilResp[0] : {};
    supabaseRequestComToken_(token, 'POST', 'logs_auditoria', {
      user_id: userId,
      nome_usuario: info.nome || null,
      email_usuario: info.email || null,
      perfil_usuario: info.perfil || null,
      acao: acao,
      detalhes: detalhes || null
    });
  } catch (e) {
    // Não interrompe a ação principal se o log falhar.
  }
}

function registrarLog(token, acao, detalhes) {
  registrarLog_(token, acao, detalhes);
}

function listarLogs(token) {
  verificarAdmin_(token);
  return supabaseRequestComToken_(token, 'GET', 'logs_auditoria?select=*&order=criado_em.desc&limit=500');
}

function getUserIdDoToken_(token) {
  var partes = token.split('.');
  var payload = JSON.parse(
    Utilities.newBlob(Utilities.base64DecodeWebSafe(partes[1])).getDataAsString()
  );
  return payload.sub;
}

function listarUsuarios(token) {
  verificarAdmin_(token);
  return supabaseRequestComToken_(token, 'GET', 'perfis_usuario?select=*&order=criado_em.desc');
}

function criarUsuario(token, dados) {
  verificarAdmin_(token);
  var cfg = getConfig_();
  var serviceKey = getServiceKey_();
  var senhaTemporaria = gerarSenhaTemporaria_();

  var criarResp = UrlFetchApp.fetch(cfg.url + '/auth/v1/admin/users', {
    method: 'POST',
    contentType: 'application/json',
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
      'User-Agent': 'GoogleAppsScript-PainelCampanha/1.0'
    },
    payload: JSON.stringify({
      email: dados.email,
      password: senhaTemporaria,
      email_confirm: true
    }),
    muteHttpExceptions: true
  });
  var criarCode = criarResp.getResponseCode();
  var criarData = JSON.parse(criarResp.getContentText());
  if (criarCode >= 400) {
    throw new Error(criarData.msg || criarData.message || 'Erro ao criar usuário no Supabase.');
  }

  var novoUserId = criarData.id;
  supabaseRequestComToken_(token, 'POST', 'perfis_usuario', {
    user_id: novoUserId,
    email: dados.email,
    nome: dados.nome,
    perfil: dados.perfil,
    ativo: true
  });

  enviarEmailAcesso_(dados.email, dados.nome, senhaTemporaria);
  registrarLog_(token, 'Criar usuário', dados.nome + ' (' + dados.email + ') — perfil ' + dados.perfil);
  return { ok: true };
}

function gerarSenhaTemporaria_() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#';
  var senha = '';
  for (var i = 0; i < 12; i++) {
    senha += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return senha;
}

function enviarEmailAcesso_(email, nome, senhaTemporaria) {
  var assunto = 'Seu acesso ao Painel de Campanha';
  var corpo = 'Olá, ' + (nome || '') + '!\n\n' +
    'Foi criado um acesso para você no Painel de Campanha.\n\n' +
    'E-mail: ' + email + '\n' +
    'Senha temporária: ' + senhaTemporaria + '\n\n' +
    'Assim que entrar, recomendamos trocar sua senha no menu do seu usuário.\n\n' +
    'Link do painel: ' + ScriptApp.getService().getUrl();
  MailApp.sendEmail(email, assunto, corpo);
}

function alternarAtivoUsuario(token, userId, ativo) {
  verificarAdmin_(token);
  var resp = supabaseRequestComToken_(token, 'PATCH', 'perfis_usuario?user_id=eq.' + userId, { ativo: ativo });
  registrarLog_(token, ativo ? 'Liberar acesso' : 'Bloquear acesso', 'Usuário ' + userId);
  return resp;
}

function trocarPerfilUsuario(token, userId, novoPerfil) {
  verificarAdmin_(token);
  var resp = supabaseRequestComToken_(token, 'PATCH', 'perfis_usuario?user_id=eq.' + userId, { perfil: novoPerfil });
  registrarLog_(token, 'Trocar perfil', 'Usuário ' + userId + ' agora é ' + novoPerfil);
  return resp;
}

function editarNomeUsuario(token, userId, novoNome) {
  verificarAdmin_(token);
  var resp = supabaseRequestComToken_(token, 'PATCH', 'perfis_usuario?user_id=eq.' + userId, { nome: novoNome });
  registrarLog_(token, 'Editar nome', 'Usuário ' + userId + ' renomeado para "' + novoNome + '"');
  return resp;
}

function redefinirSenhaUsuario(token, userId, email, nome) {
  verificarAdmin_(token);
  var cfg = getConfig_();
  var serviceKey = getServiceKey_();
  var novaSenha = gerarSenhaTemporaria_();

  var resp = UrlFetchApp.fetch(cfg.url + '/auth/v1/admin/users/' + userId, {
    method: 'PUT',
    contentType: 'application/json',
    headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey },
    payload: JSON.stringify({ password: novaSenha }),
    muteHttpExceptions: true
  });
  var code = resp.getResponseCode();
  if (code >= 400) {
    var data = JSON.parse(resp.getContentText());
    throw new Error(data.msg || data.message || 'Erro ao redefinir senha.');
  }

  enviarEmailAcesso_(email, nome, novaSenha);
  registrarLog_(token, 'Redefinir senha', 'Usuário ' + userId + ' (' + email + ')');
  return { ok: true };
}

function trocarMinhaSenha(token, novaSenha) {
  var cfg = getConfig_();
  var response = UrlFetchApp.fetch(cfg.url + '/auth/v1/user', {
    method: 'PUT',
    contentType: 'application/json',
    headers: { apikey: cfg.key, Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ password: novaSenha }),
    muteHttpExceptions: true
  });
  var code = response.getResponseCode();
  if (code >= 400) {
    var data = JSON.parse(response.getContentText());
    throw new Error(data.msg || data.message || 'Erro ao trocar senha.');
  }
  return { ok: true };
}
