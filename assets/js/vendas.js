/* Gestão de vendas, financeiro e cadastro de filamentos — TNJ.3D */
(function () {
  "use strict";

  const cfg = window.TNJConfig;
  const api = () => window.TNJApi;
  const brl = (n) =>
    "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let chartVendas = null;
  let cacheProjetos = [];

  function $(id) {
    return document.getElementById(id);
  }

  function optsResponsaveis(sel) {
    if (!sel) return;
    sel.innerHTML = "";
    (cfg.RESPONSAVEIS || []).forEach((n) => {
      const o = document.createElement("option");
      o.value = n;
      o.textContent = n;
      sel.appendChild(o);
    });
  }

  function optsPagamento(sel) {
    if (!sel) return;
    sel.innerHTML = "";
    (cfg.FORMAS_PAGAMENTO || []).forEach((f) => {
      const o = document.createElement("option");
      o.value = f.id;
      o.textContent = f.nome;
      sel.appendChild(o);
    });
  }

  async function fetchVendas() {
    if (api().isDemo()) return [];
    const data = await api().jsonp("vendas");
    if (!data.ok) throw new Error(data.error || "Falha ao carregar vendas");
    return data.vendas || [];
  }

  async function fetchFinanceiro() {
    if (api().isDemo()) {
      return { entradas: 0, saidas: 0, custos: 0, lucro: 0, maoDeObra: 0 };
    }
    const data = await api().jsonp("financeiro");
    if (!data.ok) throw new Error(data.error || "Falha ao carregar financeiro");
    return data.resumo;
  }

  async function fetchSaidas() {
    if (api().isDemo()) return [];
    const data = await api().jsonp("saidas");
    if (!data.ok) throw new Error(data.error || "Falha ao carregar saídas");
    return data.saidas || [];
  }

  async function gravarVenda(payload) {
    if (api().isDemo()) {
      await new Promise((r) => setTimeout(r, 300));
      return { ok: true, demo: true };
    }
    return api().gravar({ action: "gravarVenda", ...payload });
  }

  async function gravarSaida(payload) {
    if (api().isDemo()) {
      await new Promise((r) => setTimeout(r, 300));
      return { ok: true, demo: true };
    }
    return api().gravar({ action: "gravarSaida", ...payload });
  }

  async function adicionarFilamento(payload) {
    if (api().isDemo()) {
      await new Promise((r) => setTimeout(r, 300));
      return { ok: true, demo: true };
    }
    return api().gravar({ action: "adicionarFilamento", ...payload });
  }

  async function preencherSelectProjetos() {
    const sel = $("venda-projeto");
    if (!sel) return;
    try {
      cacheProjetos = await api().fetchProjetos();
      sel.innerHTML = '<option value="">— Selecione o projeto —</option>';
      cacheProjetos.forEach((p) => {
        const o = document.createElement("option");
        o.value = p.projetoId;
        o.textContent = `${p.projetoId} — ${p.filamento || ""} (${brl(p.precoSugerido || 0)})`;
        o.dataset.preco = p.precoSugerido || 0;
        o.dataset.custo = p.custoTotal || 0;
        sel.appendChild(o);
      });
    } catch {
      sel.innerHTML = '<option value="">Erro ao carregar projetos</option>';
    }
  }

  function aoSelecionarProjetoVenda() {
    const sel = $("venda-projeto");
    const opt = sel.options[sel.selectedIndex];
    if (opt && opt.dataset.preco) {
      $("venda-valor").value = Number(opt.dataset.preco).toFixed(2);
    }
  }

  async function registrarVenda() {
    const projetoId = $("venda-projeto").value;
    if (!projetoId) {
      $("venda-msg").textContent = "Selecione um projeto.";
      $("venda-msg").className = "save-msg err";
      return;
    }
    const opt = $("venda-projeto").selectedOptions[0];
    const payload = {
      projetoId,
      valorVenda: Number($("venda-valor").value) || 0,
      quantidadeVenda: Math.max(1, Math.floor(Number($("venda-qtd").value) || 1)),
      formaPagamento: $("venda-pagamento").value,
      responsavelVenda: $("venda-responsavel").value,
      observacoes: $("venda-obs").value.trim(),
      custoTotal: Number(opt.dataset.custo) || 0,
    };
    $("btn-registrar-venda").disabled = true;
    $("venda-msg").textContent = "Salvando…";
    try {
      const resp = await gravarVenda(payload);
      if (resp && resp.ok) {
        $("venda-msg").textContent = resp.demo ? "Venda simulada (demo)." : "Venda registrada!";
        $("venda-msg").className = "save-msg ok";
        $("venda-obs").value = "";
        $("venda-qtd").value = "1";
        await carregarVendas();
        await atualizarFinanceiro();
        if (window.TNJEstoque) await window.TNJEstoque.carregarEstoque();
      } else {
        $("venda-msg").textContent = "Erro: " + (resp && resp.error ? resp.error : "desconhecido");
        $("venda-msg").className = "save-msg err";
      }
    } catch (e) {
      $("venda-msg").textContent = "Falha: " + e.message;
      $("venda-msg").className = "save-msg err";
    } finally {
      $("btn-registrar-venda").disabled = false;
    }
  }

  async function registrarSaida() {
    const desc = $("saida-desc").value.trim();
    const valor = Number($("saida-valor").value) || 0;
    if (!desc || valor <= 0) {
      $("saida-msg").textContent = "Informe descrição e valor.";
      $("saida-msg").className = "save-msg err";
      return;
    }
    try {
      const resp = await gravarSaida({ descricao: desc, valor });
      if (resp && resp.ok) {
        $("saida-desc").value = "";
        $("saida-valor").value = "";
        $("saida-msg").textContent = "Saída registrada!";
        $("saida-msg").className = "save-msg ok";
        await carregarSaidas();
        await atualizarFinanceiro();
      }
    } catch (e) {
      $("saida-msg").textContent = "Falha: " + e.message;
      $("saida-msg").className = "save-msg err";
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
    try {
      const resp = await adicionarFilamento({ material, valor });
      if (resp && resp.ok) {
        $("novo-fil-material").value = "";
        $("novo-fil-valor").value = "";
        $("fil-msg").textContent = resp.demo
          ? "Filamento simulado (demo)."
          : "Filamento adicionado à planilha!";
        $("fil-msg").className = "save-msg ok";
        if (window.TNJApp && window.TNJApp.recarregarFilamentos) {
          await window.TNJApp.recarregarFilamentos();
        }
      }
    } catch (e) {
      $("fil-msg").textContent = "Falha: " + e.message;
      $("fil-msg").className = "save-msg err";
    }
  }

  async function carregarVendas() {
    const body = $("vendas-body");
    const info = $("vendas-info");
    if (!body) return;
    try {
      const lista = await fetchVendas();
      body.innerHTML = "";
      lista.forEach((v) => {
        const tr = document.createElement("tr");
        tr.innerHTML = [
          v.data,
          v.projetoId,
          brl(v.valorVenda),
          v.formaPagamento,
          v.responsavelVenda,
          v.responsavelProjeto || "",
          v.observacoes || "",
          brl(v.lucro || 0),
        ]
          .map((c) => `<td>${c}</td>`)
          .join("");
        body.appendChild(tr);
      });
      if (info) info.textContent = lista.length ? `${lista.length} venda(s).` : "Nenhuma venda ainda.";
    } catch (e) {
      if (info) info.textContent = "Erro: " + e.message;
    }
  }

  async function carregarSaidas() {
    const body = $("saidas-body");
    if (!body) return;
    try {
      const lista = await fetchSaidas();
      body.innerHTML = "";
      lista.forEach((s) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${s.data}</td><td>${s.descricao}</td><td>${brl(s.valor)}</td>`;
        body.appendChild(tr);
      });
    } catch {
      /* ignore */
    }
  }

  function renderChart(resumo) {
    const canvas = $("chart-financeiro");
    if (!canvas || typeof window.Chart === "undefined") return;
    const dados = {
      labels: ["Entradas", "Saídas fixas", "Custos projetos", "Lucro líquido"],
      datasets: [
        {
          label: "R$",
          data: [
            resumo.entradas || 0,
            resumo.saidas || 0,
            resumo.custos || 0,
            resumo.lucro || 0,
          ],
          backgroundColor: ["#22c55e", "#ef4444", "#f59e0b", "#8b5cf6"],
        },
      ],
    };
    if (chartVendas) chartVendas.destroy();
    chartVendas = new window.Chart(canvas, {
      type: "bar",
      data: dados,
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            ticks: {
              callback: (v) => "R$ " + v.toLocaleString("pt-BR"),
            },
          },
        },
      },
    });
  }

  async function atualizarFinanceiro() {
    try {
      const r = await fetchFinanceiro();
      const box = $("resumo-financeiro");
      if (box) {
        box.innerHTML = `
          <div class="fin-card"><small>Entradas (vendas)</small><b>${brl(r.entradas)}</b></div>
          <div class="fin-card"><small>Saídas fixas</small><b>${brl(r.saidas)}</b></div>
          <div class="fin-card"><small>Custos (projetos)</small><b>${brl(r.custos)}</b></div>
          <div class="fin-card highlight"><small>Lucro líquido</small><b>${brl(r.lucro)}</b></div>
          <div class="fin-card"><small>Mão de obra (lucro)</small><b>${brl(r.maoDeObra)}</b></div>`;
      }
      renderChart(r);
    } catch (e) {
      console.error(e);
    }
  }

  function initVendas() {
    optsResponsaveis($("venda-responsavel"));
    optsResponsaveis($("responsavel-projeto"));
    optsPagamento($("venda-pagamento"));

    $("venda-projeto")?.addEventListener("change", aoSelecionarProjetoVenda);
    $("btn-registrar-venda")?.addEventListener("click", registrarVenda);
    $("btn-registrar-saida")?.addEventListener("click", registrarSaida);
    $("btn-salvar-filamento")?.addEventListener("click", salvarFilamentoNovo);
    $("btn-recarregar-vendas")?.addEventListener("click", async () => {
      await preencherSelectProjetos();
      await carregarVendas();
      await carregarSaidas();
      await atualizarFinanceiro();
    });
  }

  async function onShowVendas() {
    await preencherSelectProjetos();
    await carregarVendas();
    await carregarSaidas();
    await atualizarFinanceiro();
  }

  window.TNJVendas = { initVendas, onShowVendas };
})();
