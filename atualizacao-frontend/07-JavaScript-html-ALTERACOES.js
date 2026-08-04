/**
 * ============================================================
 * JavaScript.html — ALTERAÇÕES (aplique no arquivo existente)
 * ============================================================
 *
 * Este arquivo reúne trechos prontos para copiar/colar.
 * Não substitua o JavaScript.html inteiro — faça as edições indicadas.
 */

// ---------------------------------------------------------------
// 1) CACHE — troque a linha let CACHE = { ... } por:
// ---------------------------------------------------------------
let CACHE = {
  financeiro: [],
  agenda: [],
  kanban: [],
  municipios: [],
  qgs: [],
  fontesRecurso: [],
  centrosCusto: [],
  subregioesMaceio: [],
  pessoas: [],
  coordenacoes: []
};

// ---------------------------------------------------------------
// 2) onResumoLoaded — adicione após popular outros CACHE:
// ---------------------------------------------------------------
// CACHE.pessoas = resumo.pessoas || [];
// CACHE.coordenacoes = resumo.coordenacoes || [];
//
// No bloco try { render... }, adicione:
// try { renderPessoas(); } catch (e) { console.error('Erro em Pessoas:', e); }

// ---------------------------------------------------------------
// 3) popularDropdownsFinanceiro — adicione ao FINAL da função:
// ---------------------------------------------------------------
function popularDropdownsFinanceiro_coordenacao() {
  const selCoord = document.getElementById('finCoordenacao');
  if (selCoord) {
    const coordAtual = selCoord.value;
    selCoord.innerHTML = '<option value="">Selecione...</option>' +
      (CACHE.coordenacoes || []).map(function (c) {
        return '<option value="' + c.id + '">' + escapeHtml(c.codigo + ' — ' + c.nome) + '</option>';
      }).join('');
    selCoord.value = coordAtual;
  }
}
// ^ Cole o corpo acima DENTRO de popularDropdownsFinanceiro(), antes do }

// ---------------------------------------------------------------
// 4) renderFinanceiro — dentro do forEach, após const centro = ...:
// ---------------------------------------------------------------
// const coordenacao = f.coordenacoes
//   ? (f.coordenacoes.codigo + ' — ' + f.coordenacoes.nome)
//   : '—';
//
// No tr.innerHTML, após a célula do centro:
// '<td>' + escapeHtml(centro) + '</td>' +
// '<td>' + escapeHtml(coordenacao) + '</td>' +

// ---------------------------------------------------------------
// 5) abrirModalFinanceiro — adicione:
// ---------------------------------------------------------------
// document.getElementById('finCoordenacao').value = '';

// ---------------------------------------------------------------
// 6) editarFinanceiro — após popular dropdowns:
// ---------------------------------------------------------------
// document.getElementById('finCoordenacao').value = f.coordenacao_id || '';

// ---------------------------------------------------------------
// 7) salvarFinanceiroForm — no objeto registro:
// ---------------------------------------------------------------
// coordenacao_id: document.getElementById('finCoordenacao').value || null,

// ---------------------------------------------------------------
// 8) exportarFinanceiroPDF — substitua o return e exportarPDF:
// ---------------------------------------------------------------
// const coordenacao = f.coordenacoes ? f.coordenacoes.codigo : '—';
// return [fmtDate(f.data), f.tipo, responsavel, centro, coordenacao, f.municipio || '—', zonaRegiao, f.status_aprovacao || 'Pendente', money(f.valor)];
// ...
// exportarPDF('Financeiro - Painel de Campanha', ['Data', 'Tipo', 'Responsável', 'Centro de Custo', 'Coordenação', 'Município', 'Zona/Região', 'Status', 'Valor'], linhas);

// ===============================================================
// BLOCO COMPLETO — cole após exportarLideresPDF (seção Líderes/QGs)
// ===============================================================

function renderPessoas() {
  const tbody = document.getElementById('tblPessoas');
  if (!tbody) return;
  tbody.innerHTML = '';
  document.getElementById('emptyPessoas').style.display = CACHE.pessoas.length ? 'none' : 'block';
  const podeEditar = podeEditarGeral();
  CACHE.pessoas.forEach(function (p) {
    const statusBadge = p.ativo
      ? '<span class="badge concluido">Ativo</span>'
      : '<span class="badge saida">Inativo</span>';
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + escapeHtml(p.nome) + '</td>' +
      '<td>' + escapeHtml(p.papel || '—') + '</td>' +
      '<td>' + escapeHtml(p.municipio || '—') + '</td>' +
      '<td>' + escapeHtml(p.telefone || '—') + '</td>' +
      '<td>' + statusBadge + '</td>' +
      '<td>' + (podeEditar ? '<button class="btn secondary" onclick="editarPessoa(\'' + p.id + '\')">Editar</button>' : '') + '</td>';
    tbody.appendChild(tr);
  });
}

function abrirModalPessoa() {
  document.getElementById('psId').value = '';
  document.getElementById('psNome').value = '';
  document.getElementById('psPapel').value = 'Líder';
  document.getElementById('psMunicipio').value = '';
  document.getElementById('psTelefone').value = '';
  document.getElementById('modalPessoa').classList.add('show');
}

function editarPessoa(id) {
  const p = CACHE.pessoas.find(function (x) { return x.id === id; });
  if (!p) return;
  document.getElementById('psId').value = p.id;
  document.getElementById('psNome').value = p.nome || '';
  document.getElementById('psPapel').value = p.papel || 'Líder';
  document.getElementById('psMunicipio').value = p.municipio || '';
  document.getElementById('psTelefone').value = p.telefone || '';
  document.getElementById('modalPessoa').classList.add('show');
}

function fecharModalPessoa() {
  document.getElementById('modalPessoa').classList.remove('show');
}

function salvarPessoaForm() {
  const registro = {
    nome: document.getElementById('psNome').value.trim(),
    papel: document.getElementById('psPapel').value.trim() || 'Líder',
    municipio: document.getElementById('psMunicipio').value.trim(),
    telefone: document.getElementById('psTelefone').value.trim()
  };
  if (!registro.nome) { alert('Preencha ao menos o nome.'); return; }
  const id = document.getElementById('psId').value;
  if (id) registro.id = id;
  setLoading(40);
  google.script.run
    .withSuccessHandler(function () { fecharModalPessoa(); recarregarTudo(); })
    .withFailureHandler(onError)
    .salvarPessoa(SESSAO.token, registro);
}

// ---------------------------------------------------------------
// AGENDA — dropdown de líder (substitui popularFiltroLideres)
// ---------------------------------------------------------------

function popularDropdownLideresAgenda() {
  const selResp = document.getElementById('agResponsavel');
  if (selResp) {
    const atual = selResp.value;
    selResp.innerHTML = '<option value="">Selecione...</option>' +
      (CACHE.pessoas || []).map(function (p) {
        return '<option value="' + p.id + '">' + escapeHtml(p.nome) + '</option>';
      }).join('');
    selResp.value = atual;
  }
  const selFiltro = document.getElementById('agendaFiltroLider');
  if (selFiltro) {
    const atualFiltro = selFiltro.value;
    selFiltro.innerHTML = '<option value="">Todos os líderes</option>' +
      (CACHE.pessoas || []).map(function (p) {
        return '<option value="' + p.id + '">' + escapeHtml(p.nome) + '</option>';
      }).join('');
    selFiltro.value = atualFiltro;
  }
}

// SUBSTITUA agendaFiltrada inteira por:
function agendaFiltrada() {
  const liderId = document.getElementById('agendaFiltroLider')
    ? document.getElementById('agendaFiltroLider').value
    : '';
  if (!liderId) return CACHE.agenda;
  return CACHE.agenda.filter(function (e) { return e.lider_id === liderId; });
}

// REMOVA a função popularFiltroLideres (não é mais usada).

// Em renderAgenda: troque popularFiltroLideres(); por popularDropdownLideresAgenda();

// Em abrirModalAgenda, troque limpar responsável por:
// popularDropdownLideresAgenda();
// document.getElementById('agResponsavel').value = '';

// Em editarAgenda, troque:
// popularDropdownLideresAgenda();
// document.getElementById('agResponsavel').value = e.lider_id || '';

// Em salvarAgendaForm, troque responsavel: ... por:
// lider_id: document.getElementById('agResponsavel').value || null,
// responsavel: (function () {
//   const p = (CACHE.pessoas || []).find(function (x) {
//     return x.id === document.getElementById('agResponsavel').value;
//   });
//   return p ? p.nome : '';
// })(),

// Listener (pode já existir — manter):
// document.addEventListener('change', function (ev) {
//   if (ev.target && ev.target.id === 'agendaFiltroLider') renderAgenda();
// });
