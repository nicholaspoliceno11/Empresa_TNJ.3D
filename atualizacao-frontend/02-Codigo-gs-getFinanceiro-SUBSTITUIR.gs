/**
 * SUBSTITUA a função getFinanceiro inteira por esta versão:
 */

function getFinanceiro(token) {
  return supabaseRequestComToken_(
    token,
    'GET',
    'financeiro?select=*,centros_custo(id,codigo,categoria,observacao_fonte),fontes_recurso(id,codigo,nome),coordenacoes(id,codigo,nome)&order=data.desc'
  );
}
