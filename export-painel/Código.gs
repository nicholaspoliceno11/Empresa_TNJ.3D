/** * PAINEL DE CAMPANHA — Backend (Google Apps Script)
* Conecta ao Supabase (projeto eleicao-2026) via API REST + Auth. * * CONFIGURAÇÃO NECESSÁRIA (antes de usar):* 1. Abra "Configurações do projeto" (ícone de engrenagem) no editor do Apps Script. * 2. Vá em "Propriedades do script" e adicione:*      SUPABASE_URL  = https://nqosjndnfwnojlldybqg.supabase.co *      SUPABASE_KEY  = <sua chave publicável (sb_publishable_...), em Configurações do projeto > Chaves de API no Supabase> * * PERFIS DE ACESSO (definidos na tabela perfis_usuario + RLS no banco):*   Gerenciador / TI   -> acesso total (ver, inserir, editar, excluir em tudo) *   Financeiro         -> vê tudo, mas só insere/edita/exclui em Financeiro *   Visualizador       -> só leitura em tudo (pode exportar PDF no front-end) * * COMO CRIAR CONTAS DE USUÁRIO (veja README.md para o passo a passo completo):* 1. No Supabase: Authentication > Users > Add user (marque "Auto Confirm User") * 2. Rode o SQL de vínculo de perfil (também está no README.md) */

function getConfig_() {const props = PropertiesService.getScriptProperties();
 const url = props.getProperty('SUPABASE_URL'); const key = props.getProperty('SUPABASE_KEY'); if (!url || !key) {throw new Error('Configure SUPABASE_URL e SUPABASE_KEY em Propriedades do script (Configurações do projeto).' ); } return { url: url, key: key }; }

/** * Serve o app web. Necessário para publicar como Web App. */ function doGet() {return HtmlService.createTemplateFromFile('Index') .evaluate() .setTitle('Painel de Campanha') .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL) .addMetaTag('viewport', 'width=device-width, initial-scale=1'); }

/** Permite incluir arquivos HTML parciais (CSS/JS/templates) */ function include(filename) {return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// --------------------------------------------------------------------// AUTENTICAÇÃO // ---------------------------------------------------------------------

/** * Faz login via Supabase Auth (email + senha) e retorna o token de acesso * junto com o perfil do usuário (da tabela perfis_usuario). */ function login(email, senha) {const cfg = getConfig_();
 const response = UrlFetchApp.fetch(cfg.url +'/auth/v1/token?grant_type=password', {method: 'POST',contentType: 'application/json',headers: { apikey: cfg.key },payload: JSON.stringify({ email: email, password: senha }),muteHttpExceptions: true }); const code = response.getResponseCode(); const data = JSON.parse(response.getContentText());

 if (code >= 400) {throw new Error(data.error_description || data.msg || 'E-mail ou senha inválidos.' ); }

 const accessToken = data.access_token;
 const usuario = data.user;

 // Busca o perfil vinculado a esse usuário const perfilResp = supabaseRequestComToken_(accessToken,'GET','perfis_usuario?select=nome,perfil,ativo&user_id=eq.' + usuario.id );

 if (!perfilResp || perfilResp.length === 0 || !perfilResp[0].ativo) {throw new Error('Este usuário não tem um perfil de acesso ativo. Contate o administrador.'); }

 registrarLog_(accessToken, 'Login', null);

 return {accessToken: accessToken,email: usuario.email,nome: perfilResp[0].nome,perfil: perfilResp[0].perfil };
}

/** * Revalida uma sessão existente (usado ao recarregar a página, se o token * ainda estiver salvo no navegador). */ function revalidarSessao(accessToken) {const userId = getUserIdDoToken_(accessToken);
 const perfilResp = supabaseRequestComToken_(accessToken, 'GET','perfis_usuario?select=nome,perfil,ativo,user_id&user_id=eq.' + userId); if (!perfilResp || perfilResp.length === 0 || !perfilResp[0].ativo) {throw new Error('Sessão inválida ou perfil inativo.'); } return { nome: perfilResp[0].nome, perfil: perfilResp[0].perfil }; }

// --------------------------------------------------------------------// HELPER DE CHAMADA À API REST DO SUPABASE (PostgREST)
// ---------------------------------------------------------------------

/** * method: GET, POST, PATCH, DELETE * path: ex. "financeiro?select=*&order=data.desc" * body: objeto (para POST/PATCH) ou null * accessToken: token do usuário logado (obrigatório - garante que o RLS *              do banco aplique as permissões corretas do perfil dele) */ function supabaseRequestComToken_(accessToken, method, path, body) {const cfg = getConfig_(); if (!accessToken) {throw new Error('Sessão expirada. Faça login novamente.'); } const options = {method: method,contentType: 'application/json',headers: {apikey: cfg.key,Authorization: 'Bearer ' + accessToken,Prefer: method === 'POST' ? 'return=representation' : method === 'PATCH' ? 'return=representation' : '' },muteHttpExceptions: true }; if (body) {options.payload = JSON.stringify(body); } const response = UrlFetchApp.fetch(cfg.url + '/rest/v1/' + path, options); const code = response.getResponseCode(); const text = response.getContentText(); if (code >= 400) {let msg = text; try { msg = JSON.parse(text).message || text; } catch (e) {} throw new Error('Erro Supabase (' + code + '): ' + msg); } return text ? JSON.parse(text) : null; }

// --------------------------------------------------------------------// FINANCEIRO  (todas as funções recebem o accessToken como 1º parâmetro)
// --------------------------------------------------------------------function getFinanceiro(token) {return supabaseRequestComToken_(token,'GET',

'financeiro?select=*,centros_custo(id,codigo,categoria,observacao_fonte),fontes_recurso(id,codigo,nome),coordenacoes(id,codigo,nome)&order=data.desc' ); }

function getFontesRecurso(token) {return supabaseRequestComToken_(token, 'GET','fontes_recurso?select=*&order=codigo.asc'); }

function getCentrosCusto(token) {return supabaseRequestComToken_(token,'GET',

'centros_custo?select=*,centro_custo_fonte(fonte_recurso_id)&order=codigo.asc' ); } function getPessoas(token) {return supabaseRequestComToken_(token, 'GET','pessoas?select=*&order=nome.asc'); }

function salvarPessoa(token, registro) {if (registro.id) {const id = registro.id;
   delete registro.id;
   const resp = supabaseRequestComToken_(token, 'PATCH', 'pessoas?id=eq.' +id, registro); registrarLog_(token, 'Editar', 'Pessoa: ' + (registro.nome || id)); return resp; } const resp = supabaseRequestComToken_(token, 'POST', 'pessoas', registro); registrarLog_(token, 'Criar', 'Pessoa: ' + registro.nome); return resp; }

function excluirPessoa(token, id) {const resp = supabaseRequestComToken_(token, 'DELETE', 'pessoas?id=eq.' +id, null); registrarLog_(token, 'Excluir', 'Pessoa: registro ' + id); return resp; }

function getCoordenacoes(token) {return supabaseRequestComToken_(token, 'GET','coordenacoes?select=*&order=codigo.asc'); }

function getSubregioesMaceio(token) {return supabaseRequestComToken_(token, 'GET','subregioes_maceio?select=*&order=id_subregiao.asc'); }

function salvarFinanceiro(token, registro) {const descricaoLog = registro.tipo + ' de ' + registro.valor +(registro.fornecedor ? ' — fornecedor ' + registro.fornecedor : '') +(registro.responsavel_pagamento ? ' (pagto: ' +registro.responsavel_pagamento + ')' : '') +(registro.responsavel_recebimento ? ' (receb.: ' +registro.responsavel_recebimento + ')' : '');

 if (registro.id) {const id = registro.id;
   delete registro.id;
   const resp = supabaseRequestComToken_(token, 'PATCH','financeiro?id=eq.' + id, registro); registrarLog_(token, 'Editar', 'Financeiro: ' + descricaoLog); return resp; } const resp = supabaseRequestComToken_(token, 'POST', 'financeiro',registro); registrarLog_(token, 'Criar', 'Financeiro: ' + descricaoLog); return resp; }

function excluirFinanceiro(token, id) {const resp = supabaseRequestComToken_(token, 'DELETE', 'financeiro?id=eq.' + id, null); registrarLog_(token, 'Excluir', 'Financeiro: registro ' + id); return resp; }

// --------------------------------------------------------------------// AGENDA // --------------------------------------------------------------------function getAgenda(token) {return supabaseRequestComToken_(token, 'GET','agenda?select=*&order=data_inicio.asc'); }

function salvarAgenda(token, registro) {if (registro.id) {const id = registro.id;
   delete registro.id;
   const resp = supabaseRequestComToken_(token, 'PATCH', 'agenda?id=eq.' +id, registro); registrarLog_(token, 'Editar', 'Agenda: ' + (registro.titulo || id)); return resp; } const resp = supabaseRequestComToken_(token, 'POST', 'agenda', registro); registrarLog_(token, 'Criar', 'Agenda: ' + registro.titulo); return resp; }

function excluirAgenda(token, id) {const resp = supabaseRequestComToken_(token, 'DELETE', 'agenda?id=eq.' +id, null); registrarLog_(token, 'Excluir', 'Agenda: registro ' + id); return resp; }

// --------------------------------------------------------------------// KANBAN // --------------------------------------------------------------------function getKanban(token) {return supabaseRequestComToken_(token, 'GET','kanban_tarefas?select=*&order=criado_em.desc'); }

function salvarKanban(token, registro) {registro.atualizado_em = new Date().toISOString();
 if (registro.id) {const id = registro.id;
   delete registro.id;
   const resp = supabaseRequestComToken_(token, 'PATCH','kanban_tarefas?id=eq.' + id, registro); registrarLog_(token, 'Editar', 'Kanban: ' + (registro.titulo || id)); return resp; } const resp = supabaseRequestComToken_(token, 'POST', 'kanban_tarefas',registro); registrarLog_(token, 'Criar', 'Kanban: ' + registro.titulo); return resp; }

function atualizarStatusKanban(token, id, novoStatus) {const resp = supabaseRequestComToken_(token, 'PATCH','kanban_tarefas?id=eq.' + id, {status: novoStatus,atualizado_em: new Date().toISOString() }); registrarLog_(token, 'Editar', 'Kanban: status alterado para "' +novoStatus + '" (registro ' + id + ')'); return resp; }

function excluirKanban(token, id) {const resp = supabaseRequestComToken_(token, 'DELETE','kanban_tarefas?id=eq.' + id, null); registrarLog_(token, 'Excluir', 'Kanban: registro ' + id); return resp; }

// --------------------------------------------------------------------// ZONAS ELEITORAIS / MUNICÍPIOS // --------------------------------------------------------------------function getMunicipios(token) {return supabaseRequestComToken_(token,'GET',

'municipios?select=municipio,regiao,eleitorado_2024,votantes_2024,abstencoe s_2024,prefeito_atual,partido_atual,alinhamento_1,status,score,nivel_risco,zona_eleitoral&order=municipio.asc' ); }

// --------------------------------------------------------------------// LÍDERES E QGs POR BAIRRO // --------------------------------------------------------------------function getQgs(token) {return supabaseRequestComToken_(token, 'GET','qgs_bairros?select=*&order=municipio.asc,bairro.asc'); }

function salvarQg(token, registro) {if (registro.id) {const id = registro.id;
   delete registro.id;
   const resp = supabaseRequestComToken_(token, 'PATCH','qgs_bairros?id=eq.' + id, registro); registrarLog_(token, 'Editar', 'QG: ' + (registro.bairro || id)); return resp; } const resp = supabaseRequestComToken_(token, 'POST', 'qgs_bairros',registro); registrarLog_(token, 'Criar', 'QG: ' + registro.bairro + ' (' +(registro.municipio || '—') + ')'); return resp; }

function excluirQg(token, id) {const resp = supabaseRequestComToken_(token, 'DELETE','qgs_bairros?id=eq.' + id, null); registrarLog_(token, 'Excluir', 'QG: registro ' + id); return resp; }

// --------------------------------------------------------------------// PAINEL GERAL — agrega os dados para os cards de KPI e gráficos // --------------------------------------------------------------------function getResumoPainel(token) {const financeiro = getFinanceiro(token);
 const agenda = getAgenda(token);
 const kanban = getKanban(token);
 const municipios = getMunicipios(token);
 const qgs = getQgs(token);
 const fontesRecurso = getFontesRecurso(token);
 const centrosCusto = getCentrosCusto(token);
 const subregioesMaceio = getSubregioesMaceio(token);
 const pessoas = getPessoas(token);
 const coordenacoes = getCoordenacoes(token);

 let totalEntradas = 0;
 let totalSaidas = 0;
 financeiro.forEach(function (f) {if (f.tipo === 'Entrada') totalEntradas += Number(f.valor); else totalSaidas += Number(f.valor); });

 const kanbanPorStatus = { Pendente: 0, Andamento: 0, Concluído: 0 };
 kanban.forEach(function (t) {kanbanPorStatus[t.status] = (kanbanPorStatus[t.status] || 0) + 1;
 });

 const hoje = new Date();
 const proximosEventos = agenda.filter(function (e) {return new Date(e.data_inicio) >= hoje && e.status === 'Agendado'; }).length;

 return {totalEntradas: totalEntradas,totalSaidas: totalSaidas,saldo: totalEntradas - totalSaidas,kanbanPorStatus: kanbanPorStatus,totalTarefas: kanban.length,proximosEventos: proximosEventos,totalMunicipios: municipios.length,financeiro: financeiro,agenda: agenda,kanban: kanban,municipios: municipios,qgs: qgs,fontesRecurso: fontesRecurso,centrosCusto: centrosCusto,pessoas: pessoas,coordenacoes: coordenacoes,subregioesMaceio: subregioesMaceio };
}

// --------------------------------------------------------------------// ADMINISTRAÇÃO DE USUÁRIOS (restrito a Gerenciador / TI)
// Usa a chave secreta do Supabase (SUPABASE_SERVICE_KEY) — SOMENTE aqui,// nunca enviada ao navegador. Configure em Propriedades do script. // ---------------------------------------------------------------------

function getServiceKey_() {const key = PropertiesService.getScriptProperties().getProperty('SUPABASE_SERVICE_KEY') ; if (!key) {throw new Error('Configure SUPABASE_SERVICE_KEY em Propriedades do script (chave secreta do Supabase, começa com sb_secret_...).' ); } return key; }

/** Verifica se o token pertence a um usuário Gerenciador ou TI. Lança erro se não for. */ function verificarAdmin_(token) {const perfilResp = supabaseRequestComToken_(token, 'GET','perfis_usuario?select=perfil&user_id=eq.' + getUserIdDoToken_(token)); const perfil = perfilResp && perfilResp[0] ? perfilResp[0].perfil : null; if (perfil !== 'Gerenciador' && perfil !== 'TI') {throw new Error('Apenas Gerenciador ou TI podem gerenciar usuários.'); } }

// --------------------------------------------------------------------// AUDITORIA (logs)
// ---------------------------------------------------------------------

/** * Registra uma ação no log de auditoria. Nunca lança erro para não quebrar * a ação principal caso o log falhe por algum motivo. */ function registrarLog_(token, acao, detalhes) {try {const userId = getUserIdDoToken_(token);
   const perfilResp = supabaseRequestComToken_(token, 'GET','perfis_usuario?select=nome,email,perfil&user_id=eq.' + userId); const info = perfilResp && perfilResp[0] ? perfilResp[0] : {}; supabaseRequestComToken_(token, 'POST', 'logs_auditoria', {user_id: userId,nome_usuario: info.nome || null,email_usuario: info.email || null,perfil_usuario: info.perfil || null,acao: acao,detalhes: detalhes || null }); } catch (e) {// Não interrompe a ação principal se o log falhar. } }

/** Chamada pelo cliente para registrar ações que não passam pelo backend (ex: exportar PDF). */ function registrarLog(token, acao, detalhes) {registrarLog_(token, acao, detalhes);
}

/** Lista os logs de auditoria (mais recentes primeiro). Requer Gerenciador/TI. */ function listarLogs(token) {verificarAdmin_(token);
 return supabaseRequestComToken_(token, 'GET','logs_auditoria?select=*&order=criado_em.desc&limit=500'); }

/** Extrai o user_id (sub) de dentro do JWT do Supabase, sem precisar de outra chamada de rede. */ function getUserIdDoToken_(token) {const partes = token.split('.'); const payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(partes[1])).getDataAsString()); return payload.sub; }

/** Lista todos os usuários cadastrados (perfis_usuario). Requer Gerenciador/TI. */ function listarUsuarios(token) {verificarAdmin_(token);
 return supabaseRequestComToken_(token, 'GET','perfis_usuario?select=*&order=criado_em.desc'); }

/** * Cria um novo usuário no Supabase Auth (com senha temporária gerada),* salva o perfil dele, e envia um e-mail com os dados de acesso. * Requer Gerenciador/TI. */ function criarUsuario(token, dados) {verificarAdmin_(token);
 const cfg = getConfig_();
 const serviceKey = getServiceKey_();
 const senhaTemporaria = gerarSenhaTemporaria_();

 const criarResp = UrlFetchApp.fetch(cfg.url + '/auth/v1/admin/users', {method: 'POST',contentType: 'application/json',headers: {apikey: serviceKey,Authorization: 'Bearer ' + serviceKey,'User-Agent': 'GoogleAppsScript-PainelCampanha/1.0' },payload: JSON.stringify({ email: dados.email, password: senhaTemporaria,email_confirm: true }),muteHttpExceptions: true }); const criarCode = criarResp.getResponseCode(); const criarData = JSON.parse(criarResp.getContentText()); if (criarCode >= 400) {throw new Error(criarData.msg || criarData.message || 'Erro ao criar usuário no Supabase.'); }

 const novoUserId = criarData.id;

 supabaseRequestComToken_(token, 'POST', 'perfis_usuario', {user_id: novoUserId,email: dados.email,nome: dados.nome,perfil: dados.perfil,ativo: true });

 enviarEmailAcesso_(dados.email, dados.nome, senhaTemporaria);
 registrarLog_(token, 'Criar usuário', dados.nome + ' (' + dados.email + ') — perfil ' + dados.perfil);

 return { ok: true };
}

function gerarSenhaTemporaria_() {const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#'; let senha = ''; for (let i = 0; i < 12; i++) {senha += chars.charAt(Math.floor(Math.random() * chars.length)); } return senha; }

function enviarEmailAcesso_(email, nome, senhaTemporaria) {const assunto = 'Seu acesso ao Painel de Campanha'; const corpo = 'Olá, ' + (nome || '') + '!\n\n' +'Foi criado um acesso para você no Painel de Campanha.\n\n' +'E-mail: ' + email + '\n' +'Senha temporária: ' + senhaTemporaria + '\n\n' +'Assim que entrar, recomendamos trocar sua senha no menu do seu usuário (canto superior direito > Trocar senha).\n\n' +'Link do painel: ' + ScriptApp.getService().getUrl(); MailApp.sendEmail(email, assunto, corpo); }

/** Ativa ou desativa o acesso de um usuário. Requer Gerenciador/TI. */ function alternarAtivoUsuario(token, userId, ativo) {verificarAdmin_(token);
 const resp = supabaseRequestComToken_(token, 'PATCH','perfis_usuario?user_id=eq.' + userId, { ativo: ativo }); registrarLog_(token, ativo ? 'Liberar acesso' : 'Bloquear acesso','Usuário ' + userId); return resp; }

/** Troca o perfil de um usuário. Requer Gerenciador/TI. */ function trocarPerfilUsuario(token, userId, novoPerfil) {verificarAdmin_(token);
 const resp = supabaseRequestComToken_(token, 'PATCH','perfis_usuario?user_id=eq.' + userId, { perfil: novoPerfil }); registrarLog_(token, 'Trocar perfil', 'Usuário ' + userId + ' agora é ' +novoPerfil); return resp; }

/** Edita o nome de um usuário. Requer Gerenciador/TI. */ function editarNomeUsuario(token, userId, novoNome) {verificarAdmin_(token);
 const resp = supabaseRequestComToken_(token, 'PATCH','perfis_usuario?user_id=eq.' + userId, { nome: novoNome }); registrarLog_(token, 'Editar nome', 'Usuário ' + userId + ' renomeado para "' + novoNome + '"'); return resp; }

/** * Gera uma nova senha temporária para um usuário e envia por e-mail. * Requer Gerenciador/TI. Usa a chave secreta (service role). */ function redefinirSenhaUsuario(token, userId, email, nome) {verificarAdmin_(token);
 const cfg = getConfig_();
 const serviceKey = getServiceKey_();
 const novaSenha = gerarSenhaTemporaria_();

 const resp = UrlFetchApp.fetch(cfg.url + '/auth/v1/admin/users/' + userId,{method: 'PUT',contentType: 'application/json',headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey },payload: JSON.stringify({ password: novaSenha }),muteHttpExceptions: true }); const code = resp.getResponseCode(); if (code >= 400) {const data = JSON.parse(resp.getContentText()); throw new Error(data.msg || data.message || 'Erro ao redefinir senha.'); }

 enviarEmailAcesso_(email, nome, novaSenha);
 registrarLog_(token, 'Redefinir senha', 'Usuário ' + userId + ' (' + email + ')'); return { ok: true }; }

/** Qualquer usuário logado pode trocar a própria senha. */ function trocarMinhaSenha(token, novaSenha) {const cfg = getConfig_();
 const response = UrlFetchApp.fetch(cfg.url + '/auth/v1/user', {method: 'PUT',contentType: 'application/json',headers: { apikey: cfg.key, Authorization: 'Bearer ' + token },payload: JSON.stringify({ password: novaSenha }),muteHttpExceptions: true }); const code = response.getResponseCode(); if (code >= 400) {const data = JSON.parse(response.getContentText()); throw new Error(data.msg || data.message || 'Erro ao trocar senha.'); } return { ok: true }; }