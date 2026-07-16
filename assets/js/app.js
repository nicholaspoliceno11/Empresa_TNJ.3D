/* Wiring principal TNJ.3D */
(function () {
  "use strict";

  const cfg = window.TNJConfig;
  const Calc = window.TNJCalc;
  const STORAGE_KEY = "tnj_api_url";
  const SEQ_KEY = "tnj_projeto_seq";
  const MAX_FIL = cfg.MAX_FILAMENTOS || 4;

  function resolveApiUrl() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = (params.get("api") || "").trim();
    if (fromQuery) {
      try {
        localStorage.setItem(STORAGE_KEY, fromQuery);
      } catch {
        /* ignore */
      }
      return fromQuery;
    }
    const fromConfig = (cfg.API_URL || "").trim();
    if (fromConfig) return fromConfig;
    try {
      const fromStorage = (localStorage.getItem(STORAGE_KEY) || "").trim();
      if (fromStorage) return fromStorage;
    } catch {
      /* ignore */
    }
    return "";
  }

  let API_URL = resolveApiUrl();
  let DEMO = API_URL === "";
  let filamentos = [];
  let custosReutilizados = null;
  let filamentoResumoReuse = "";

  const $ = (id) => document.getElementById(id);
  const brl = (n) =>
    "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const API_TIMEOUT_MS = 20000;
  const ERRO_CONEXAO =
    'Falha de conexão. Confirme no Apps Script: "Quem tem acesso: Qualquer pessoa" e Nova versão.';

  function apiJsonp(action, extraParams) {
    return new Promise((resolve, reject) => {
      const cb = "_tnjCb" + Date.now();
      let script;
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(ERRO_CONEXAO));
      }, API_TIMEOUT_MS);
      function cleanup() {
        clearTimeout(timer);
        delete window[cb];
        if (script && script.parentNode) script.remove();
      }
      window[cb] = (data) => {
        cleanup();
        resolve(data);
      };
      script = document.createElement("script");
      const u = new URL(API_URL);
      u.searchParams.set("action", action);
      if (extraParams) {
        Object.entries(extraParams).forEach(([k, v]) => u.searchParams.set(k, v));
      }
      u.searchParams.set("callback", cb);
      script.src = u.toString();
      script.onerror = () => {
        cleanup();
        reject(new Error(ERRO_CONEXAO));
      };
      document.head.appendChild(script);
    });
  }

  async function apiPost(body) {
    const payload = JSON.stringify(body);
    const attempts = [
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: "payload=" + encodeURIComponent(payload),
      },
      { headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: payload },
    ];
    let lastErr;
    for (const req of attempts) {
      try {
        const res = await fetch(API_URL, { method: "POST", ...req });
        return JSON.parse(await res.text());
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error(ERRO_CONEXAO);
  }

  async function apiGravar(body) {
    if (DEMO) {
      await new Promise((r) => setTimeout(r, 300));
      return { ok: true, demo: true };
    }
    const json = JSON.stringify(body);
    if (json.length <= 7500) return apiJsonp("gravar", { payload: json });
    return apiPost(body);
  }

  window.TNJApi = {
    isDemo: () => DEMO,
    jsonp: apiJsonp,
    gravar: apiGravar,
    fetchProjetos: async () => {
      if (DEMO) return [];
      const data = await apiJsonp("projetos");
      if (!data.ok) throw new Error(data.error);
      return data.projetos;
    },
    fetchProjetoDetalhe: async (projetoId, dataRegistro) => {
      if (DEMO) throw new Error("Indisponível no modo demonstração");
      const resp = await apiJsonp("projetoDetalhe", {
        projetoId,
        data: dataRegistro || "",
      });
      if (!resp.ok) throw new Error(resp.error);
      return resp.detalhe;
    },
    fetchProximoIdReutilizacao: async (projetoId) => {
      if (DEMO) {
        const raiz = String(projetoId).match(/^(PRJ-\d{8}-\d{3})/)?.[1] || projetoId;
        const hoje = new Date();
        const p = (n) => String(n).padStart(2, "0");
        const d = `${hoje.getFullYear()}${p(hoje.getMonth() + 1)}${p(hoje.getDate())}`;
        return { projetoId: `${raiz}-${d}`, idRaiz: raiz };
      }
      const resp = await apiJsonp("proximoIdReutilizacao", { projetoId });
      if (!resp.ok) throw new Error(resp.error);
      return resp;
    },
    fetchEstoque: async () => {
      if (DEMO) return [];
      const data = await apiJsonp("estoque");
      if (!data.ok) throw new Error(data.error);
      return data.estoque || [];
    },
  };

  function optionsFilamentos(sel) {
    sel.innerHTML = "";
    filamentos.forEach((f, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = `${f.material} — ${brl(f.valor)}/Kg`;
      sel.appendChild(o);
    });
  }

  function buildFilamentSlots() {
    const wrap = $("filamentos-slots");
    if (!wrap) return;
    wrap.innerHTML = "";
    for (let i = 0; i < MAX_FIL; i++) {
      const div = document.createElement("div");
      div.className = "fil-slot" + (i > 0 ? " fil-slot-extra" : "");
      div.dataset.idx = String(i);
      div.innerHTML = `
        <div class="fil-slot-head">
          <label><input type="checkbox" class="fil-ativo" ${i === 0 ? "checked" : ""}/> Filamento ${i + 1}</label>
        </div>
        <label>Material</label>
        <select class="fil-select"></select>
        <div class="row">
          <div><label>Preço (R$/Kg)</label><input class="fil-preco" type="number" step="0.01" min="0"/></div>
          <div><label>Quantidade</label><div class="input-unit">
            <input class="fil-qtd" type="number" step="0.01" min="0" value="${i === 0 ? "1.14" : "0"}"/>
            <select class="fil-un-qtd"><option value="g" selected>g</option><option value="kg">Kg</option></select>
          </div></div>
        </div>
        <div class="row">
          <div><label>Tempo impressão</label><div class="input-unit">
            <input class="fil-tempo" type="number" step="0.01" min="0" value="${i === 0 ? "0.12" : "0"}"/>
            <select class="fil-un-tempo"><option value="h" selected>horas</option><option value="min">min</option></select>
          </div></div>
        </div>`;
      wrap.appendChild(div);
      const sel = div.querySelector(".fil-select");
      optionsFilamentos(sel);
      sel.addEventListener("change", () => {
        limparReutilizacao();
        onFilSelect(div);
      });
      div.querySelectorAll("input,select").forEach((n) =>
        n.addEventListener("input", () => {
          limparReutilizacao();
          recalcular();
        })
      );
      div.querySelector(".fil-ativo").addEventListener("change", () => {
        limparReutilizacao();
        recalcular();
      });
      if (i === 0) onFilSelect(div);
    }
  }

  function indiceFilamentoPorMaterial(material) {
    const nome = String(material || "").trim().toLowerCase();
    if (!nome) return 0;
    const idx = filamentos.findIndex((f) => String(f.material).trim().toLowerCase() === nome);
    return idx >= 0 ? idx : 0;
  }

  function indiceImpressoraPorNome(nome) {
    const alvo = String(nome || "").trim().toLowerCase();
    const lista = cfg.IMPRESSORAS || [];
    const idx = lista.findIndex((imp) => String(imp.nome).trim().toLowerCase() === alvo);
    return idx >= 0 ? idx : 0;
  }

  function aplicarFilamentosSlots(lista) {
    const slots = document.querySelectorAll(".fil-slot");
    slots.forEach((slot, i) => {
      const fil = lista[i];
      const ativo = slot.querySelector(".fil-ativo");
      if (!fil) {
        ativo.checked = false;
        return;
      }
      ativo.checked = fil.ativo !== false;
      slot.querySelector(".fil-select").value = String(indiceFilamentoPorMaterial(fil.material));
      slot.querySelector(".fil-preco").value = Number(fil.precoFilamentoKg || 0).toFixed(2);
      slot.querySelector(".fil-qtd").value = fil.quantidade ?? 0;
      slot.querySelector(".fil-un-qtd").value = fil.unidadeQuantidade || "g";
      slot.querySelector(".fil-tempo").value = fil.tempo ?? 0;
      slot.querySelector(".fil-un-tempo").value = fil.unidadeTempo || "h";
      if (!Number(fil.precoFilamentoKg)) onFilSelect(slot);
    });
  }

  function limparReutilizacao() {
    custosReutilizados = null;
    filamentoResumoReuse = "";
  }

  function aplicarCustosReutilizados(r) {
    if (!custosReutilizados) return r;
    const q = r.quantidadePecas;
    const u = custosReutilizados;
    const margem = Calc.toNumber($("margem").value);
    r.custosUnitarios = {
      filamento: u.filamento,
      energia: u.energia,
      maoDeObra: u.maoDeObra,
      custosFixos: u.custosFixos,
      insumos: u.insumos,
      total: Calc.round2(u.filamento + u.energia + u.maoDeObra + u.custosFixos + u.insumos),
    };
    r.custos = {
      filamento: Calc.round2(u.filamento * q),
      energia: Calc.round2(u.energia * q),
      maoDeObra: Calc.round2(u.maoDeObra * q),
      custosFixos: Calc.round2(u.custosFixos * q),
      insumos: Calc.round2(u.insumos * q),
    };
    r.custoTotalUnitario = r.custosUnitarios.total;
    r.custoTotal = Calc.round2(r.custoTotalUnitario * q);
    r.margem = margem;
    r.precoSugerido = Calc.round2(r.custoTotalUnitario * (1 + margem / 100));
    r.lucroEstimado = Calc.round2(r.precoSugerido - r.custoTotalUnitario);
    r.precoSugeridoLote = Calc.round2(r.precoSugerido * q);
    r.lucroEstimadoLote = Calc.round2(r.lucroEstimado * q);
    if (filamentoResumoReuse) r.filamentoResumo = filamentoResumoReuse;
    r.tabelaMargens = [30, 50, 80, 100].map((m) => {
      const preco = r.custoTotalUnitario * (1 + m / 100);
      return {
        margem: m,
        precoSugerido: Calc.round2(preco),
        lucroEstimado: Calc.round2(preco - r.custoTotalUnitario),
      };
    });
    return r;
  }

  function rotuloProjeto(p) {
    const nome = String(p.nomeObjeto || "").trim();
    return nome ? `${p.projetoId} — ${nome}` : p.projetoId;
  }

  function aplicarDetalheProjeto(detalhe) {
    $("qtdPecas").value = String(detalhe.quantidadePecas || 1);
    if ($("nomeObjeto")) $("nomeObjeto").value = detalhe.nomeObjeto || "";
    if ($("responsavel-projeto") && detalhe.responsavelProjeto) {
      $("responsavel-projeto").value = detalhe.responsavelProjeto;
    }
    if (detalhe.impressora) {
      $("impressora").value = String(indiceImpressoraPorNome(detalhe.impressora));
    }
    if (detalhe.consumoW) $("consumoW").value = detalhe.consumoW;
    if (detalhe.valorKwh) $("valorKwh").value = detalhe.valorKwh;
    if (detalhe.taxaManutencaoHora) $("taxaManutencao").value = detalhe.taxaManutencaoHora;
    if (detalhe.maoDeObra !== undefined) $("maoDeObra").value = detalhe.maoDeObra;
    if (detalhe.insumos !== undefined) $("insumos").value = detalhe.insumos;
    if (detalhe.margem !== undefined) $("margem").value = detalhe.margem;
    if (detalhe.filamentos && detalhe.filamentos.length) {
      aplicarFilamentosSlots(detalhe.filamentos);
    }
    custosReutilizados = detalhe.custosUnitarios || null;
    filamentoResumoReuse = detalhe.filamento || "";
    recalcular();
  }

  async function preencherSelectReutilizar() {
    const sel = $("reutilizar-projeto");
    if (!sel) return;
    const msg = $("reutilizar-msg");
    sel.innerHTML = '<option value="">— Novo projeto em branco —</option>';
    if (DEMO) {
      if (msg) msg.textContent = "Conecte à planilha para listar projetos anteriores.";
      return;
    }
    try {
      const lista = await window.TNJApi.fetchProjetos();
      lista.sort((a, b) =>
        rotuloProjeto(a).localeCompare(rotuloProjeto(b), "pt-BR", { sensitivity: "base" })
      );
      lista.forEach((p) => {
        const o = document.createElement("option");
        o.value = `${p.projetoId}|${p.data}`;
        o.textContent = `${rotuloProjeto(p)} — ${p.filamento || "sem filamento"} — ${p.data} (qtd ${p.quantidadePecas || 1})`;
        sel.appendChild(o);
      });
      if (msg) {
        msg.textContent = lista.length
          ? `${lista.length} projeto(s) disponível(is) para reutilizar.`
          : "Nenhum projeto registrado ainda.";
        msg.className = "save-msg ok";
      }
    } catch (e) {
      if (msg) {
        msg.textContent = "Não foi possível carregar projetos: " + e.message;
        msg.className = "save-msg err";
      }
    }
  }

  async function aoSelecionarProjetoAnterior() {
    const sel = $("reutilizar-projeto");
    const msg = $("reutilizar-msg");
    if (!sel || !sel.value) {
      if (msg) msg.textContent = "";
      limparReutilizacao();
      if ($("nomeObjeto")) $("nomeObjeto").value = "";
      await atualizarProjetoId();
      return;
    }
    const [projetoId, data] = sel.value.split("|");
    if (msg) {
      msg.textContent = "Carregando dados do projeto…";
      msg.className = "save-msg";
    }
    try {
      const detalhe = await window.TNJApi.fetchProjetoDetalhe(projetoId, data);
      aplicarDetalheProjeto(detalhe);
      await atualizarIdReutilizacao(projetoId);
      if (msg) {
        msg.textContent =
          `Dados de ${projetoId} carregados. ID derivado — pode editar o final se quiser. Ajuste a quantidade e clique em Criar custo.`;
        msg.className = "save-msg ok";
      }
    } catch (e) {
      if (msg) {
        msg.textContent = "Erro ao carregar: " + e.message;
        msg.className = "save-msg err";
      }
    }
  }

  function onFilSelect(slot) {
    const f = filamentos[Number(slot.querySelector(".fil-select").value)];
    if (f) slot.querySelector(".fil-preco").value = Number(f.valor).toFixed(2);
    recalcular();
  }

  function lerFilamentosSlots() {
    const lista = [];
    document.querySelectorAll(".fil-slot").forEach((slot) => {
      const ativo = slot.querySelector(".fil-ativo").checked;
      if (!ativo) return;
      const idx = Number(slot.querySelector(".fil-select").value);
      const f = filamentos[idx];
      lista.push({
        ativo: true,
        material: f ? f.material : "",
        precoFilamentoKg: slot.querySelector(".fil-preco").value,
        quantidade: slot.querySelector(".fil-qtd").value,
        unidadeQuantidade: slot.querySelector(".fil-un-qtd").value,
        tempo: slot.querySelector(".fil-tempo").value,
        unidadeTempo: slot.querySelector(".fil-un-tempo").value,
      });
    });
    return lista;
  }

  function lerEntradas() {
    return {
      filamentos: lerFilamentosSlots(),
      consumoW: $("consumoW").value,
      valorKwh: $("valorKwh").value,
      maoDeObra: $("maoDeObra").value,
      taxaManutencaoHora: $("taxaManutencao").value,
      insumos: $("insumos").value,
      margem: $("margem").value,
      quantidadePecas: $("qtdPecas").value,
    };
  }

  function recalcular() {
    let r = Calc.calcular(lerEntradas());
    r = aplicarCustosReutilizados(r);
    $("r-filamento").textContent = brl(r.custos.filamento);
    $("r-energia").textContent = brl(r.custos.energia);
    $("r-maoobra").textContent = brl(r.custos.maoDeObra);
    $("r-fixos").textContent = brl(r.custos.custosFixos);
    $("r-insumos").textContent = brl(r.custos.insumos);
    $("r-total").textContent = brl(r.custoTotal);
    const unitWrap = $("r-total-unit-wrap");
    const precoLoteWrap = $("r-preco-lote-wrap");
    if (r.quantidadePecas > 1) {
      if (unitWrap) unitWrap.hidden = false;
      if ($("r-total-unit")) $("r-total-unit").textContent = brl(r.custoTotalUnitario);
      if (precoLoteWrap) precoLoteWrap.hidden = false;
      if ($("r-preco-lote")) {
        $("r-preco-lote").textContent = brl(r.precoSugeridoLote || r.precoSugerido * r.quantidadePecas);
      }
    } else {
      if (unitWrap) unitWrap.hidden = true;
      if (precoLoteWrap) precoLoteWrap.hidden = true;
    }
    if ($("r-preco")) $("r-preco").textContent = brl(r.precoSugerido);
    if ($("r-lucro")) $("r-lucro").textContent = brl(r.lucroEstimado);

    const det = $("r-filamentos-detalhe");
    if (det) {
      det.innerHTML = r.filamentos
        .map(
          (f) =>
            `<li><span>${f.material || "—"}</span><span>${f.gramas}g · ${f.horas.toFixed(2)}h · ${brl(f.custoUnitario)}</span></li>`
        )
        .join("");
    }

    const tb = $("tabela-margens");
    tb.innerHTML = "";
    r.tabelaMargens.forEach((m) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${m.margem}%</td><td>${brl(m.precoSugerido)}</td><td>${brl(m.lucroEstimado)}</td>`;
      tb.appendChild(tr);
    });
    return r;
  }

  async function fetchFilamentos() {
    if (DEMO) return cfg.FILAMENTOS_DEMO.slice();
    const data = await apiJsonp("filamentos");
    if (!data.ok) throw new Error(data.error);
    return data.filamentos;
  }

  async function recarregarFilamentos() {
    filamentos = await fetchFilamentos();
    document.querySelectorAll(".fil-select").forEach((sel) => optionsFilamentos(sel));
    recalcular();
  }

  window.TNJApp = { recarregarFilamentos, preencherSelectReutilizar };

  function gerarIdLocal() {
    const hoje = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const d = `${hoje.getFullYear()}${p(hoje.getMonth() + 1)}${p(hoje.getDate())}`;
    const chave = `${SEQ_KEY}_${d}`;
    const seq = Number(localStorage.getItem(chave) || "0") + 1;
    localStorage.setItem(chave, String(seq));
    return `${cfg.PREFIXO_PROJETO || "PRJ"}-${d}-${String(seq).padStart(3, "0")}`;
  }

  async function atualizarProjetoId() {
    const campo = $("projetoId");
    if (campo) campo.setAttribute("readonly", "");
    try {
      if (DEMO) throw new Error("demo");
      const data = await apiJsonp("proximoId");
      $("projetoId").value = data.projetoId;
    } catch {
      $("projetoId").value = gerarIdLocal();
    }
  }

  async function atualizarIdReutilizacao(projetoIdBase) {
    const campo = $("projetoId");
    if (!campo) return;
    campo.removeAttribute("readonly");
    try {
      const resp = await window.TNJApi.fetchProximoIdReutilizacao(projetoIdBase);
      campo.value = resp.projetoId;
    } catch {
      const raiz = String(projetoIdBase).match(/^(PRJ-\d{8}-\d{3})/)?.[1] || projetoIdBase;
      const hoje = new Date();
      const p = (n) => String(n).padStart(2, "0");
      const d = `${hoje.getFullYear()}${p(hoje.getMonth() + 1)}${p(hoje.getDate())}`;
      campo.value = `${raiz}-${d}`;
    }
  }

  async function criarCusto() {
    const id = $("projetoId").value.trim();
    if (!id) {
      await atualizarProjetoId();
      return;
    }
    const r = recalcular();
    const payload = {
      projetoId: id,
      nomeObjeto: ($("nomeObjeto")?.value || "").trim(),
      quantidadePecas: r.quantidadePecas,
      impressora: $("impressora").selectedOptions[0]?.textContent || "",
      responsavelProjeto: $("responsavel-projeto").value,
      filamento: r.filamentoResumo || filamentoResumoReuse,
      filamentos: r.filamentos,
      quantidadeG: r.gramas,
      horas: Calc.round2(r.horas),
      consumoW: Calc.toNumber($("consumoW").value),
      valorKwh: Calc.toNumber($("valorKwh").value),
      taxaManutencaoHora: Calc.toNumber($("taxaManutencao").value),
      margem: r.margem,
      custos: r.custos,
      custosUnitarios: r.custosUnitarios,
      custoTotalUnitario: r.custoTotalUnitario,
      custoTotal: r.custoTotal,
      precoSugerido: r.precoSugerido,
      lucroEstimado: r.lucroEstimado,
    };

    $("btn-criar").disabled = true;
    $("save-msg").textContent = "Salvando…";
    try {
      const resp = await apiGravar(payload);
      if (resp && resp.ok) {
        $("save-msg").textContent = resp.demo
          ? `Custo ${id} calculado (demo).`
          : `Custo ${id} gravado na planilha!`;
        $("save-msg").className = "save-msg ok";
        $("qtdPecas").value = "1";
        if ($("nomeObjeto")) $("nomeObjeto").value = "";
        $("reutilizar-projeto").value = "";
        $("reutilizar-msg").textContent = "";
        limparReutilizacao();
        await atualizarProjetoId();
        await preencherSelectReutilizar();
      } else {
        $("save-msg").textContent = "Erro: " + (resp?.error || "desconhecido");
        $("save-msg").className = "save-msg err";
      }
    } catch (e) {
      $("save-msg").textContent = "Falha ao salvar: " + e.message;
      $("save-msg").className = "save-msg err";
    } finally {
      $("btn-criar").disabled = false;
    }
  }

  async function excluirProjeto(projetoId, data, nomeObjeto) {
    const label = nomeObjeto ? `"${nomeObjeto}" (${projetoId})` : projetoId;
    const msg =
      `Excluir o projeto ${label}?\n\n` +
      "Isso remove o registro de todas as abas da planilha e ajusta o estoque. Não pode ser desfeito.";
    if (!confirm(msg)) return;

    const info = $("projetos-info");
    info.textContent = "Excluindo...";
    try {
      const resp = await apiGravar({ action: "excluirProjeto", projetoId, data });
      if (!resp?.ok) throw new Error(resp?.error || "Erro ao excluir");
      await carregarProjetos();
      preencherSelectReutilizar();
    } catch (e) {
      info.textContent = "Erro: " + e.message;
    }
  }

  async function carregarProjetos() {
    const info = $("projetos-info");
    const totaisBox = $("projetos-totais");
    if (DEMO) {
      info.textContent = "Modo demonstração.";
      if (totaisBox) totaisBox.hidden = true;
      return;
    }
    try {
      const lista = await apiJsonp("projetos").then((d) => d.projetos || []);
      $("projetos-body").innerHTML = "";
      const soma = {
        filamento: 0,
        energia: 0,
        maoDeObra: 0,
        manut: 0,
        insumos: 0,
        total: 0,
      };
      lista.forEach((p) => {
        soma.filamento += Number(p.custoFilamento) || 0;
        soma.energia += Number(p.custoEnergia) || 0;
        soma.maoDeObra += Number(p.maoDeObra) || 0;
        soma.manut += Number(p.custosFixos) || 0;
        soma.insumos += Number(p.insumos) || 0;
        soma.total += Number(p.custoTotal) || 0;
        const tr = document.createElement("tr");
        tr.innerHTML = [
          p.data, p.projetoId, p.nomeObjeto || "—", p.quantidadePecas || 1, p.responsavelProjeto || "",
          p.impressora || "", p.filamento || "",
          brl(p.custoFilamento), brl(p.custoEnergia), brl(p.maoDeObra),
          brl(p.custosFixos), brl(p.insumos), brl(p.custoTotal),
          (p.margem || 0) + "%", brl(p.precoSugeridoUnit ?? p.precoSugerido),
        ].map((c) => `<td>${c}</td>`).join("");
        const tdAcoes = document.createElement("td");
        tdAcoes.className = "td-acoes";
        const btnExcluir = document.createElement("button");
        btnExcluir.type = "button";
        btnExcluir.className = "btn-excluir-projeto";
        btnExcluir.title = "Excluir projeto";
        btnExcluir.textContent = "Excluir";
        btnExcluir.addEventListener("click", () => {
          excluirProjeto(p.projetoId, p.data, p.nomeObjeto || "");
        });
        tdAcoes.appendChild(btnExcluir);
        tr.appendChild(tdAcoes);
        $("projetos-body").appendChild(tr);
      });
      if (totaisBox) {
        if (lista.length) {
          totaisBox.hidden = false;
          totaisBox.innerHTML = `
            <div class="fin-card"><small>Total Filamento</small><b>${brl(soma.filamento)}</b></div>
            <div class="fin-card"><small>Total Energia</small><b>${brl(soma.energia)}</b></div>
            <div class="fin-card"><small>Total M.O.</small><b>${brl(soma.maoDeObra)}</b></div>
            <div class="fin-card"><small>Total Manut.</small><b>${brl(soma.manut)}</b></div>
            <div class="fin-card"><small>Total Insumos</small><b>${brl(soma.insumos)}</b></div>
            <div class="fin-card highlight"><small>Custo total (todos)</small><b>${brl(soma.total)}</b></div>`;
        } else {
          totaisBox.hidden = true;
          totaisBox.innerHTML = "";
        }
      }
      info.textContent = lista.length ? `${lista.length} projeto(s).` : "Nenhum projeto.";
    } catch (e) {
      info.textContent = "Erro: " + e.message;
      if (totaisBox) totaisBox.hidden = true;
    }
  }

  function setConn(state, label) {
    $("conn-status").className = "conn " + state;
    $("conn-status").querySelector(".conn-label").textContent = label;
    $("mode-badge").textContent = DEMO ? "MODO DEMONSTRAÇÃO" : "CONECTADO À PLANILHA";
  }

  function initTabs() {
    document.querySelectorAll(".tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
        btn.classList.add("active");
        $("view-" + btn.dataset.view).classList.add("active");
        const v = btn.dataset.view;
        if (v === "calculadora") preencherSelectReutilizar();
        if (v === "projetos") carregarProjetos();
        if (v === "vendas" && window.TNJVendas) window.TNJVendas.onShowVendas();
        if (v === "estoque" && window.TNJEstoque) window.TNJEstoque.onShowEstoque();
      });
    });
  }

  function initConfig() {
    if (cfg.PLANILHA_URL) $("link-planilha").href = cfg.PLANILHA_URL;
    if ($("api-url-input")) $("api-url-input").value = API_URL;
    const logo = $("brand-logo-img");
    if (logo && cfg.LOGO) logo.src = cfg.LOGO;
  }

  async function conectarApi() {
    const url = ($("api-url-input").value || "").trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/.test(url)) {
      $("setup-msg").textContent = "URL inválida.";
      return;
    }
    localStorage.setItem(STORAGE_KEY, url);
    location.reload();
  }

  async function init() {
    const p = cfg.PADROES;
    $("consumoW").value = p.consumoW;
    $("valorKwh").value = p.valorKwh;
    $("maoDeObra").value = p.maoDeObra;
    $("taxaManutencao").value = p.taxaManutencaoHora;
    $("insumos").value = p.insumos;
    $("margem").value = p.margem;

    (cfg.IMPRESSORAS || []).forEach((imp, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = imp.nome;
      $("impressora").appendChild(o);
    });
    $("impressora").addEventListener("change", () => {
      const imp = cfg.IMPRESSORAS[Number($("impressora").value)];
      if (imp) $("consumoW").value = imp.consumoW;
      recalcular();
    });

    buildFilamentSlots();
    initTabs();
    initConfig();
    if (window.TNJVendas) window.TNJVendas.initVendas();
    if (window.TNJEstoque) window.TNJEstoque.initEstoque();

    ["consumoW", "valorKwh", "maoDeObra", "taxaManutencao", "insumos"].forEach((id) =>
      $(id).addEventListener("input", () => {
        limparReutilizacao();
        recalcular();
      })
    );
    ["margem", "qtdPecas"].forEach((id) => $(id).addEventListener("input", recalcular));
    $("btn-criar").addEventListener("click", criarCusto);
    $("btn-recarregar").addEventListener("click", carregarProjetos);
    $("reutilizar-projeto")?.addEventListener("change", aoSelecionarProjetoAnterior);
    $("btn-conectar")?.addEventListener("click", conectarApi);
    $("btn-desconectar")?.addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    });
    $("btn-testar-api")?.addEventListener("click", async () => {
      try {
        const data = await apiJsonp("filamentos");
        $("setup-msg").textContent = `OK — ${(data.filamentos || []).length} filamento(s).`;
        $("setup-msg").className = "setup-msg ok";
      } catch (e) {
        $("setup-msg").textContent = "Falha: " + e.message;
        $("setup-msg").className = "save-msg err";
      }
    });

    setConn(DEMO ? "demo" : "ok", DEMO ? "modo demonstração" : "conectando…");
    await atualizarProjetoId();
    try {
      filamentos = await fetchFilamentos();
      document.querySelectorAll(".fil-select").forEach((sel) => optionsFilamentos(sel));
      document.querySelectorAll(".fil-slot").forEach((slot, i) => {
        if (i === 0) onFilSelect(slot);
      });
      if (!DEMO) setConn("ok", "conectado");
      await preencherSelectReutilizar();
    } catch {
      filamentos = cfg.FILAMENTOS_DEMO.slice();
      document.querySelectorAll(".fil-select").forEach((sel) => optionsFilamentos(sel));
      setConn("err", "API indisponível");
    }
    recalcular();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
