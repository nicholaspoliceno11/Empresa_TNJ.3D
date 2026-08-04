/**
 * Cole estas 4 funções em Codigo.gs, perto de getQgs / getCentrosCusto.
 */

function getPessoas(token) {
  return supabaseRequestComToken_(token, 'GET', 'pessoas?select=*&order=nome.asc');
}

function salvarPessoa(token, registro) {
  if (registro.id) {
    var id = registro.id;
    delete registro.id;
    var resp = supabaseRequestComToken_(token, 'PATCH', 'pessoas?id=eq.' + id, registro);
    registrarLog_(token, 'Editar', 'Pessoa: ' + (registro.nome || id));
    return resp;
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
