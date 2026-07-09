/* Estoque de projetos — TNJ.3D */
(function () {
  "use strict";

  const api = () => window.TNJApi;
  const brl = (n) =>
    "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function $(id) {
    return document.getElementById(id);
  }

  async function carregarEstoque() {
    const body = $("estoque-body");
    const info = $("estoque-info");
    if (!body) return;
    if (api().isDemo()) {
      if (info) info.textContent = "Modo demonstração.";
      return;
    }
    try {
      const lista = await api().fetchEstoque();
      body.innerHTML = "";
      lista.forEach((e) => {
        const tr = document.createElement("tr");
        tr.innerHTML = [
          e.idRaiz,
          e.nomeObjeto || "—",
          e.filamento || "",
          e.qtdEstoque,
          brl(e.precoRef),
          e.ultimaAtualizacao || "",
        ]
          .map((c) => `<td>${c}</td>`)
          .join("");
        body.appendChild(tr);
      });
      if (info) {
        info.textContent = lista.length
          ? `${lista.length} item(ns) em estoque.`
          : "Nenhum item no estoque ainda. Crie um custo na calculadora para entrar.";
      }
    } catch (e) {
      if (info) info.textContent = "Erro: " + e.message;
    }
  }

  function initEstoque() {
    $("btn-recarregar-estoque")?.addEventListener("click", carregarEstoque);
  }

  async function onShowEstoque() {
    await carregarEstoque();
  }

  window.TNJEstoque = { initEstoque, onShowEstoque, carregarEstoque };
})();
