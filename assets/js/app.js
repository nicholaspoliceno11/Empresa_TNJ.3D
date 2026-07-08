/* Wiring da interface TNJ.3D: carrega filamentos, calcula em tempo real e salva custos. */
(function () {
  "use strict";

  const cfg = window.TNJConfig;
  const Calc = window.TNJCalc;
  const STORAGE_KEY = "tnj_api_url";
  const SEQ_KEY = "tnj_projeto_seq";

  function resolveApiUrl() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = (params.get("api") || "").trim();
    if (fromQuery) {
      try {
        localStorage.setItem(STORAGE_KEY, fromQuery);
      } catch {
        /* localStorage indisponível */
      }
      return fromQuery;
    }
    const fromConfig = (cfg.API_URL || "").trim();
    if (fromConfig) return fromConfig;
    try {
      const fromStorage = (localStorage.getItem(STORAGE_KEY) || "").trim();
      if (fromStorage) return fromStorage;
    } catch {
      /* localStorage indisponível */
    }
    return "";
  }

  let API_URL = resolveApiUrl();
  let DEMO = API_URL === "";

  const $ = (id) => document.getElementById(id);

  const el = {
    filamento: $("filamento"),
    preco: $("precoFilamento"),
    quantidade: $("quantidade"),
    unidadeQuantidade: $("unidadeQuantidade"),
    consumoW: $("consumoW"),
    valorKwh: $("valorKwh"),
    tempo: $("tempo"),
    unidadeTempo: $("unidadeTempo"),
    maoDeObra: $("maoDeObra"),
    taxaManutencao: $("taxaManutencao"),
    insumos: $("insumos"),
    margem: $("margem"),
    impressora: $("impressora"),
    projetoId: $("projetoId"),
    qtdPecas: $("qtdPecas"),
    btnCriar: $("btn-criar"),
    saveMsg: $("save-msg"),
    // resultados
    rFilamento: $("r-filamento"),
    rEnergia: $("r-energia"),
    rMaoobra: $("r-maoobra"),
    rFixos: $("r-fixos"),
    rInsumos: $("r-insumos"),
    rTotal: $("r-total"),
    rPreco: $("r-preco"),
    rLucro: $("r-lucro"),
    tabelaMargens: $("tabela-margens"),
    // conexão
    conn: $("conn-status"),
    modeBadge: $("mode-badge"),
    // projetos
    projetosBody: $("projetos-body"),
    projetosInfo: $("projetos-info"),
    btnRecarregar: $("btn-recarregar"),
    // configuração
    linkPlanilha: $("link-planilha"),
    apiUrlInput: $("api-url-input"),
    btnConectar: $("btn-conectar"),
    btnDesconectar: $("btn-desconectar"),
    btnTestarApi: $("btn-testar-api"),
    setupMsg: $("setup-msg"),
  };

  let filamentos = [];

  const brl = (n) =>
    "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* --------------------- API --------------------- */
  // POST + text/plain evita bloqueio CORS do Apps Script (GET redireciona e falha no fetch).
  async function apiPost(body) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Resposta inválida da API. Verifique a URL /exec do Apps Script.");
    }
  }

  async function fetchFilamentos() {
    if (DEMO) return cfg.FILAMENTOS_DEMO.slice();
    const data = await apiPost({ action: "filamentos" });
    if (!data.ok) throw new Error(data.error || "Falha ao carregar filamentos");
    return data.filamentos;
  }

  async function fetchProjetos() {
    if (DEMO) return [];
    const data = await apiPost({ action: "projetos" });
    if (!data.ok) throw new Error(data.error || "Falha ao carregar projetos");
    return data.projetos;
  }

  async function fetchProximoId() {
    if (DEMO) return gerarIdLocal();
    const data = await apiPost({ action: "proximoId" });
    if (!data.ok) throw new Error(data.error || "Falha ao gerar ID");
    return data.projetoId;
  }

  function hojeCompacto() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  }

  function gerarIdLocal() {
    const hoje = hojeCompacto();
    const chave = `${SEQ_KEY}_${hoje}`;
    let seq = Number(localStorage.getItem(chave) || "0") + 1;
    localStorage.setItem(chave, String(seq));
    const prefixo = cfg.PREFIXO_PROJETO || "PRJ";
    return `${prefixo}-${hoje}-${String(seq).padStart(3, "0")}`;
  }

  async function atualizarProjetoId() {
    try {
      el.projetoId.value = await fetchProximoId();
    } catch (e) {
      el.projetoId.value = gerarIdLocal();
      console.warn("Usando ID local:", e);
    }
  }

  function preencherImpressoras() {
    const lista = cfg.IMPRESSORAS || [];
    el.impressora.innerHTML = "";
    lista.forEach((imp, i) => {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = imp.nome;
      el.impressora.appendChild(opt);
    });
    aoSelecionarImpressora();
  }

  function aoSelecionarImpressora() {
    const imp = (cfg.IMPRESSORAS || [])[Number(el.impressora.value)];
    if (imp && imp.consumoW) {
      el.consumoW.value = imp.consumoW;
      recalcular();
    }
  }

  function impressoraSelecionada() {
    const imp = (cfg.IMPRESSORAS || [])[Number(el.impressora.value)];
    return imp ? imp.nome : "";
  }

  async function salvarCusto(payload) {
    if (DEMO) {
      await new Promise((r) => setTimeout(r, 300));
      return { ok: true, demo: true };
    }
    return apiPost(payload);
  }

  function showSetup(msg, cls) {
    el.setupMsg.textContent = msg;
    el.setupMsg.className = "setup-msg " + (cls || "");
  }

  function normalizarApiUrl(raw) {
    const url = (raw || "").trim();
    if (!url) return "";
    if (/script\.googleusercontent\.com/i.test(url)) {
      throw new Error(
        "Não use a URL de redirecionamento (googleusercontent.com). " +
          "Cole a URL original que termina em /exec (script.google.com/macros/s/.../exec)."
      );
    }
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/.test(url)) {
      throw new Error("URL inválida. Deve começar com https://script.google.com/macros/s/ e terminar em /exec");
    }
    return url;
  }

  function salvarApiUrl(raw) {
    const url = normalizarApiUrl(raw);
    localStorage.setItem(STORAGE_KEY, url);
    API_URL = url;
    DEMO = false;
    return url;
  }

  function limparApiUrl() {
    localStorage.removeItem(STORAGE_KEY);
    API_URL = (cfg.API_URL || "").trim();
    DEMO = API_URL === "";
  }

  async function testarConexao(url) {
    const testUrl = url || API_URL;
    if (!testUrl) throw new Error("Informe a URL do App da Web.");
    normalizarApiUrl(testUrl);
    const prev = API_URL;
    API_URL = testUrl;
    try {
      const data = await apiPost({ action: "filamentos" });
      if (!data.ok) throw new Error(data.error || "Resposta inválida da API");
      return data.filamentos || [];
    } finally {
      API_URL = prev;
    }
  }

  function initConfig() {
    if (cfg.PLANILHA_URL && el.linkPlanilha) {
      el.linkPlanilha.href = cfg.PLANILHA_URL;
    }
    if (el.apiUrlInput) {
      el.apiUrlInput.value = API_URL;
    }
    if (!DEMO) {
      showSetup("Conectado à planilha.", "ok");
    }
  }

  async function conectarApi() {
    try {
      const url = salvarApiUrl(el.apiUrlInput.value);
      showSetup("Testando conexão…", "");
      el.btnConectar.disabled = true;
      const lista = await testarConexao(url);
      showSetup(`Conectado! ${lista.length} filamento(s) carregado(s) da planilha.`, "ok");
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      limparApiUrl();
      showSetup("Erro: " + e.message, "err");
    } finally {
      el.btnConectar.disabled = false;
    }
  }

  function desconectarApi() {
    limparApiUrl();
    showSetup("API removida do navegador. Recarregando…", "");
    setTimeout(() => location.reload(), 400);
  }

  async function testarApi() {
    try {
      el.btnTestarApi.disabled = true;
      showSetup("Testando…", "");
      const url = normalizarApiUrl(el.apiUrlInput.value || API_URL);
      const lista = await testarConexao(url);
      showSetup(`OK — API respondeu com ${lista.length} filamento(s).`, "ok");
    } catch (e) {
      showSetup("Falha no teste: " + e.message, "err");
    } finally {
      el.btnTestarApi.disabled = false;
    }
  }

  function initConfigEvents() {
    if (el.btnConectar) el.btnConectar.addEventListener("click", conectarApi);
    if (el.btnDesconectar) el.btnDesconectar.addEventListener("click", desconectarApi);
    if (el.btnTestarApi) el.btnTestarApi.addEventListener("click", testarApi);
  }

  /* --------------------- UI helpers --------------------- */
  function setConn(state, label) {
    el.conn.className = "conn " + state;
    el.conn.querySelector(".conn-label").textContent = label;
    el.modeBadge.textContent = DEMO ? "MODO DEMONSTRAÇÃO" : "CONECTADO À PLANILHA";
  }

  function preencherPadroes() {
    const p = cfg.PADROES;
    el.consumoW.value = p.consumoW;
    el.valorKwh.value = p.valorKwh;
    el.maoDeObra.value = p.maoDeObra;
    el.taxaManutencao.value = p.taxaManutencaoHora;
    el.insumos.value = p.insumos;
    el.margem.value = p.margem;
  }

  function preencherFilamentos(lista) {
    filamentos = lista;
    el.filamento.innerHTML = "";
    lista.forEach((f, i) => {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `${f.material} — ${brl(f.valor)}/Kg`;
      el.filamento.appendChild(opt);
    });
    aoSelecionarFilamento();
  }

  function aoSelecionarFilamento() {
    const f = filamentos[Number(el.filamento.value)];
    if (f) el.preco.value = Number(f.valor).toFixed(2);
    recalcular();
  }

  function lerEntradas() {
    return {
      precoFilamentoKg: el.preco.value,
      quantidade: el.quantidade.value,
      unidadeQuantidade: el.unidadeQuantidade.value,
      consumoW: el.consumoW.value,
      valorKwh: el.valorKwh.value,
      tempo: el.tempo.value,
      unidadeTempo: el.unidadeTempo.value,
      maoDeObra: el.maoDeObra.value,
      taxaManutencaoHora: el.taxaManutencao.value,
      insumos: el.insumos.value,
      margem: el.margem.value,
      quantidadePecas: el.qtdPecas.value,
    };
  }

  function recalcular() {
    const r = Calc.calcular(lerEntradas());
    el.rFilamento.textContent = brl(r.custos.filamento);
    el.rEnergia.textContent = brl(r.custos.energia);
    el.rMaoobra.textContent = brl(r.custos.maoDeObra);
    el.rFixos.textContent = brl(r.custos.custosFixos);
    el.rInsumos.textContent = brl(r.custos.insumos);
    el.rTotal.textContent = brl(r.custoTotal);
    el.rPreco.textContent = brl(r.precoSugerido);
    el.rLucro.textContent = brl(r.lucroEstimado);

    el.tabelaMargens.innerHTML = "";
    r.tabelaMargens.forEach((m) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${m.margem}%</td><td>${brl(m.precoSugerido)}</td><td>${brl(
        m.lucroEstimado
      )}</td>`;
      el.tabelaMargens.appendChild(tr);
    });
    return r;
  }

  async function criarCusto() {
    const id = el.projetoId.value.trim();
    if (!id) {
      await atualizarProjetoId();
      showSave("Gerando ID do projeto…", "");
      return;
    }
    const r = recalcular();
    const f = filamentos[Number(el.filamento.value)];
    const payload = {
      projetoId: id,
      quantidadePecas: r.quantidadePecas,
      impressora: impressoraSelecionada(),
      filamento: f ? f.material : "",
      precoFilamentoKg: Calc.toNumber(el.preco.value),
      quantidadeG: r.gramas,
      horas: r.horas,
      consumoW: Calc.toNumber(el.consumoW.value),
      valorKwh: Calc.toNumber(el.valorKwh.value),
      margem: r.margem,
      custos: r.custos,
      custosUnitarios: r.custosUnitarios,
      custoTotalUnitario: r.custoTotalUnitario,
      custoTotal: r.custoTotal,
      precoSugerido: r.precoSugerido,
      lucroEstimado: r.lucroEstimado,
    };

    el.btnCriar.disabled = true;
    showSave("Salvando…", "");
    try {
      const resp = await salvarCusto(payload);
      if (resp && resp.ok) {
        showSave(
          resp.demo
            ? `Custo calculado (${id}, ${r.quantidadePecas} peça(s)) — modo demonstração.`
            : `Custo ${id} gravado na planilha (${r.quantidadePecas} peça(s))!`,
          "ok"
        );
        el.qtdPecas.value = "1";
        await atualizarProjetoId();
        if (!DEMO) carregarProjetos();
      } else {
        showSave("Erro: " + (resp && resp.error ? resp.error : "desconhecido"), "err");
      }
    } catch (e) {
      showSave("Falha ao salvar: " + e.message, "err");
    } finally {
      el.btnCriar.disabled = false;
    }
  }

  function showSave(msg, cls) {
    el.saveMsg.textContent = msg;
    el.saveMsg.className = "save-msg " + (cls || "");
  }

  async function carregarProjetos() {
    if (DEMO) {
      el.projetosInfo.textContent =
        "Modo demonstração: conecte a API (Apps Script) para listar os projetos gravados na planilha.";
      return;
    }
    el.projetosInfo.textContent = "Carregando…";
    try {
      const lista = await fetchProjetos();
      el.projetosBody.innerHTML = "";
      lista.forEach((p) => {
        const tr = document.createElement("tr");
        tr.innerHTML = [
          p.data || "",
          p.projetoId || "",
          p.quantidadePecas || 1,
          p.impressora || "",
          p.filamento || "",
          brl(p.custoFilamento || 0),
          brl(p.custoEnergia || 0),
          brl(p.maoDeObra || 0),
          brl(p.custosFixos || 0),
          brl(p.insumos || 0),
          brl(p.custoTotal || 0),
          (p.margem || 0) + "%",
          brl(p.precoSugerido || 0),
        ]
          .map((c) => `<td>${c}</td>`)
          .join("");
        el.projetosBody.appendChild(tr);
      });
      el.projetosInfo.textContent = lista.length
        ? `${lista.length} projeto(s) registrado(s).`
        : "Nenhum projeto registrado ainda.";
    } catch (e) {
      el.projetosInfo.textContent = "Erro ao carregar: " + e.message;
    }
  }

  /* --------------------- Navegação --------------------- */
  function initTabs() {
    document.querySelectorAll(".tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
        btn.classList.add("active");
        $("view-" + btn.dataset.view).classList.add("active");
        if (btn.dataset.view === "projetos") carregarProjetos();
      });
    });
  }

  function initEvents() {
    el.filamento.addEventListener("change", aoSelecionarFilamento);
    el.impressora.addEventListener("change", aoSelecionarImpressora);
    [
      "preco",
      "quantidade",
      "unidadeQuantidade",
      "consumoW",
      "valorKwh",
      "tempo",
      "unidadeTempo",
      "maoDeObra",
      "taxaManutencao",
      "insumos",
      "margem",
      "qtdPecas",
    ].forEach((k) => el[k].addEventListener("input", recalcular));
    el.btnCriar.addEventListener("click", criarCusto);
    el.btnRecarregar.addEventListener("click", carregarProjetos);
  }

  /* --------------------- Bootstrap --------------------- */
  async function init() {
    preencherPadroes();
    preencherImpressoras();
    initTabs();
    initEvents();
    initConfig();
    initConfigEvents();
    setConn(DEMO ? "demo" : "ok", DEMO ? "modo demonstração" : "conectando…");
    await atualizarProjetoId();
    try {
      const lista = await fetchFilamentos();
      preencherFilamentos(lista);
      if (!DEMO) setConn("ok", "conectado");
    } catch (e) {
      preencherFilamentos(cfg.FILAMENTOS_DEMO.slice());
      setConn("err", "API indisponível — usando lista local");
      console.error(e);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
