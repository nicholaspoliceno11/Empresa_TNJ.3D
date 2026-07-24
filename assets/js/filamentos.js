/* Gestão da aba Filamentos — TNJ.3D */
(function () {
  "use strict";

  const cfg = window.TNJConfig;
  const api = () => window.TNJApi;
  const brl = (n) =>
    "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let demoFilamentos = null;
  let cacheLista = [];
  let apiFilamentosDesatualizada = false;

  function $(id) {
    return document.getElementById(id);
  }

  function normalizarDemo(lista) {
    return lista.map((f, i) => ({
      linha: f.linha || i + 2,
      material: f.material,
      valor: Number(f.valor) || 0,
      qtd: Number(f.qtd) || 1,
      status: f.status || (f.ativo === false ? "Esgotado" : "Ativo"),
      ativo: f.ativo !== false && f.status !== "Esgotado",
    }));
  }

  function getDemoFilamentos() {
    if (!demoFilamentos) {
      demoFilamentos = normalizarDemo(cfg.FILAMENTOS_DEMO || []);
    }
    return demoFilamentos;
  }

  async function fetchListaFilamentos() {
    if (api().isDemo()) {
      apiFilamentosDesatualizada = false;
      return getDemoFilamentos().slice();
    }
    const data = await api().jsonp("filamentos");
    if (!data.ok) throw new Error(data.error || "Falha ao carregar filamentos");
    const raw = data.filamentos || [];
    apiFilamentosDesatualizada = !raw.some(
      (f) => f.linha !== undefined || f.status !== undefined || f.ativo !== undefined
    );
    return raw.map((f, i) => ({
      ...f,
      linha: f.linha || i + 2,
      status: f.status || (f.ativo === false ? "Esgotado" : "Ativo"),
      ativo: f.ativo !== false && f.status !== "Esgotado",
    }));
  }

  function validarRespostaFilamento(resp, acaoEsperada) {
    if (!resp?.ok) throw new Error(resp?.error || "Erro ao salvar na planilha");
    if (resp.demo) return;
    const r = resp.resultado || {};
    if (acaoEsperada === "alterarStatusFilamento" && !r.status) {
      throw new Error(
        "O servidor não atualizou o status. Cole o apps-script/Codigo.gs na planilha e publique Nova versão do App da Web."
      );
    }
    if (acaoEsperada === "atualizarFilamento" && !r.material) {
      throw new Error(
        "O servidor não salvou a edição. Atualize o Apps Script (Codigo.gs) e publique Nova versão."
      );
    }
    if (acaoEsperada === "excluirFilamento" && r.material === undefined && !r.linha) {
      throw new Error(
        "O servidor não excluiu o filamento. Atualize o Apps Script (Codigo.gs) e publique Nova versão."
      );
    }
    if (acaoEsperada === "adicionarFilamento" && !r.material) {
      throw new Error(
        "O servidor não adicionou o filamento. Atualize o Apps Script (Codigo.gs) e publique Nova versão."
      );
    }
  }

  async function gravarAcao(payload) {
    if (api().isDemo()) {
      await new Promise((r) => setTimeout(r, 200));
      return { ok: true, demo: true };
    }
    return api().gravar(payload);
  }

  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function badgeStatus(f) {
    if (f.ativo === false || f.status === "Esgotado") {
      return '<span class="fil-badge fil-badge-esgotado">Esgotado</span>';
    }
    return '<span class="fil-badge fil-badge-ativo">Ativo</span>';
  }

  function lerEdicaoFilamento(tr) {
    return {
      material: tr.querySelector(".fil-edit-material")?.value.trim() || "",
      valor: Number(tr.querySelector(".fil-edit-valor")?.value) || 0,
    };
  }

  function entrarEdicaoFilamento(tr, f) {
    if (document.querySelector("tr.filamento-em-edicao")) return;
    tr.classList.add("filamento-em-edicao");
    tr.dataset.linha = String(f.linha);
    tr.innerHTML = `
      <td><input type="text" class="fil-edit-material" value="${escHtml(f.material)}" maxlength="120"/></td>
      <td><input type="number" class="fil-edit-valor" step="0.01" min="0" value="${Number(f.valor).toFixed(2)}"/></td>
      <td>${badgeStatus(f)}</td>
      <td class="td-acoes">
        <button type="button" class="btn-salvar-projeto btn-salvar-filamento">Salvar</button>
        <button type="button" class="btn-cancelar-projeto btn-cancelar-filamento">Cancelar</button>
      </td>`;
    tr.querySelector(".btn-salvar-filamento")?.addEventListener("click", () => salvarFilamento(tr, f));
    tr.querySelector(".btn-cancelar-filamento")?.addEventListener("click", () => carregarFilamentos());
  }

  async function salvarFilamento(tr, f) {
    const dados = lerEdicaoFilamento(tr);
    const info = $("filamentos-info");
    if (!dados.material || dados.valor <= 0) {
      if (info) info.textContent = "Informe nome e valor válidos.";
      return;
    }
    if (info) info.textContent = "Salvando…";
    try {
      if (api().isDemo()) {
        const lista = getDemoFilamentos();
        const idx = lista.findIndex((x) => x.linha === f.linha);
        if (idx >= 0) {
          lista[idx].material = dados.material;
          lista[idx].valor = dados.valor;
        }
      } else {
        const resp = await gravarAcao({
          action: "atualizarFilamento",
          linha: f.linha,
          material: dados.material,
          valor: dados.valor,
        });
        validarRespostaFilamento(resp, "atualizarFilamento");
      }
      await sincronizarCalculadora();
      await carregarFilamentos();
      if (info) info.textContent = "Filamento atualizado.";
    } catch (e) {
      if (info) info.textContent = "Erro: " + e.message;
    }
  }

  async function excluirFilamento(f) {
    const msg = `Excluir o filamento "${f.material}"?\n\nIsso remove o registro da planilha. Não pode ser desfeito.`;
    if (!confirm(msg)) return;
    const info = $("filamentos-info");
    if (info) info.textContent = "Excluindo…";
    try {
      if (api().isDemo()) {
        demoFilamentos = getDemoFilamentos().filter((x) => x.linha !== f.linha);
        demoFilamentos.forEach((x, i) => {
          x.linha = i + 2;
        });
      } else {
        const resp = await gravarAcao({ action: "excluirFilamento", linha: f.linha });
        validarRespostaFilamento(resp, "excluirFilamento");
      }
      await sincronizarCalculadora();
      await carregarFilamentos();
    } catch (e) {
      if (info) info.textContent = "Erro: " + e.message;
    }
  }

  async function alternarEsgotado(f) {
    if (apiFilamentosDesatualizada) {
      $("filamentos-info").textContent =
        "Atualize o Apps Script (Codigo.gs) e publique Nova versão para marcar filamentos como esgotados.";
      $("filamentos-info").className = "save-msg err";
      return;
    }
    const esgotado = f.ativo !== false;
    const acao = esgotado ? "marcar como esgotado" : "reativar";
    const msg = esgotado
      ? `Marcar "${f.material}" como esgotado?\n\nEle não aparecerá mais na calculadora.`
      : `Reativar "${f.material}" na calculadora?`;
    if (!confirm(`Deseja ${acao} este filamento?\n\n${msg}`)) return;
    const info = $("filamentos-info");
    if (info) info.textContent = "Atualizando…";
    try {
      if (api().isDemo()) {
        const item = getDemoFilamentos().find((x) => x.linha === f.linha);
        if (item) {
          item.ativo = !esgotado;
          item.status = esgotado ? "Esgotado" : "Ativo";
        }
      } else {
        const resp = await gravarAcao({
          action: "alterarStatusFilamento",
          linha: f.linha,
          esgotado: esgotado,
        });
        validarRespostaFilamento(resp, "alterarStatusFilamento");
      }
      await sincronizarCalculadora();
      await carregarFilamentos();
      if (info) info.textContent = esgotado ? "Filamento marcado como esgotado." : "Filamento reativado.";
    } catch (e) {
      if (info) info.textContent = "Erro: " + e.message;
    }
  }

  async function sincronizarCalculadora() {
    if (window.TNJApp && window.TNJApp.recarregarFilamentos) {
      await window.TNJApp.recarregarFilamentos();
    }
  }

  function renderLinhaFilamento(f) {
    const tr = document.createElement("tr");
    if (!f.ativo) tr.classList.add("filamento-esgotado");
    tr.innerHTML = `
      <td>${escHtml(f.material)}</td>
      <td>${brl(f.valor)}</td>
      <td>${badgeStatus(f)}</td>
      <td class="td-acoes"></td>`;
    const acoes = tr.querySelector(".td-acoes");

    const btnEditar = document.createElement("button");
    btnEditar.type = "button";
    btnEditar.className = "btn-editar-projeto";
    btnEditar.textContent = "Editar";
    btnEditar.addEventListener("click", () => entrarEdicaoFilamento(tr, f));

    const btnEsgotado = document.createElement("button");
    btnEsgotado.type = "button";
    btnEsgotado.className = f.ativo ? "btn-fil-esgotado" : "btn-fil-reativar";
    btnEsgotado.textContent = f.ativo ? "Acabou" : "Reativar";
    btnEsgotado.title = f.ativo
      ? "Marca como esgotado — some da calculadora (clique no botão, não digite no nome)"
      : "Voltar a aparecer na calculadora";
    btnEsgotado.addEventListener("click", () => alternarEsgotado(f));

    const btnExcluir = document.createElement("button");
    btnExcluir.type = "button";
    btnExcluir.className = "btn-excluir-projeto";
    btnExcluir.textContent = "Excluir";
    btnExcluir.addEventListener("click", () => excluirFilamento(f));

    acoes.appendChild(btnEditar);
    acoes.appendChild(btnEsgotado);
    acoes.appendChild(btnExcluir);
    return tr;
  }

  async function carregarFilamentos() {
    const body = $("filamentos-body");
    const info = $("filamentos-info");
    if (!body) return;
    try {
      cacheLista = await fetchListaFilamentos();
      body.innerHTML = "";
      cacheLista.forEach((f) => body.appendChild(renderLinhaFilamento(f)));
      const ativos = cacheLista.filter((f) => f.ativo !== false).length;
      if (info) {
        let texto = cacheLista.length
          ? `${cacheLista.length} filamento(s) · ${ativos} disponível(is) na calculadora.`
          : "Nenhum filamento cadastrado.";
        if (apiFilamentosDesatualizada) {
          texto +=
            " Para usar Editar, Acabou e Excluir, atualize o Apps Script (Codigo.gs) e publique Nova versão.";
        }
        info.textContent = texto;
        info.className = apiFilamentosDesatualizada ? "save-msg err" : "muted";
      }
    } catch (e) {
      if (info) info.textContent = "Erro: " + e.message;
    }
  }

  async function salvarFilamentoNovo() {
    const material = $("novo-fil-material").value.trim();
    const valor = Number($("novo-fil-valor").value) || 0;
    if (!material || valor <= 0) {
      $("fil-msg").textContent = "Informe nome e valor pago por Kg.";
      $("fil-msg").className = "save-msg err";
      return;
    }
    $("btn-salvar-filamento").disabled = true;
    $("fil-msg").textContent = "Salvando…";
    try {
      if (api().isDemo()) {
        await new Promise((r) => setTimeout(r, 300));
        const lista = getDemoFilamentos();
        const linha = lista.length + 2;
        lista.push({
          linha,
          material,
          valor,
          qtd: 1,
          status: "Ativo",
          ativo: true,
        });
      } else {
        const resp = await gravarAcao({ action: "adicionarFilamento", material, valor });
        validarRespostaFilamento(resp, "adicionarFilamento");
      }
      $("novo-fil-material").value = "";
      $("novo-fil-valor").value = "";
      $("fil-msg").textContent = api().isDemo()
        ? "Filamento simulado (demo)."
        : "Filamento adicionado à planilha!";
      $("fil-msg").className = "save-msg ok";
      await sincronizarCalculadora();
      await carregarFilamentos();
    } catch (e) {
      $("fil-msg").textContent = "Falha: " + e.message;
      $("fil-msg").className = "save-msg err";
    } finally {
      $("btn-salvar-filamento").disabled = false;
    }
  }

  function initFilamentos() {
    $("btn-salvar-filamento")?.addEventListener("click", salvarFilamentoNovo);
  }

  async function onShowFilamentos() {
    await carregarFilamentos();
  }

  window.TNJFilamentos = {
    initFilamentos,
    onShowFilamentos,
    fetchListaFilamentos,
    getDemoFilamentos,
  };
})();
