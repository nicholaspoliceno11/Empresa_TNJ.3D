/* Gestão de vendas, financeiro, caixa e cadastro de filamentos — TNJ.3D */
(function () {
  "use strict";

  const cfg = window.TNJConfig;
  const api = () => window.TNJApi;
  const brl = (n) =>
    "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let chartVendas = null;
  let cacheProjetos = [];
  let caixaVisivel = false;

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

  const MAX_PARCELAS = 12;

  function pagamentoEhCartaoCredito(id) {
    return id === "CC";
  }

  function pagamentoEhCartao(id) {
    return id === "CC" || id === "CD";
  }

  function preencherOptsParcelas(sel) {
    if (!sel) return;
    sel.innerHTML = "";
    for (let n = 1; n <= MAX_PARCELAS; n++) {
      const o = document.createElement("option");
      o.value = String(n);
      o.textContent = n === 1 ? "À vista (1x)" : `${n}x`;
      sel.appendChild(o);
    }
  }

  function valorParcela(total, parcelas) {
    const p = Math.max(1, Math.floor(Number(parcelas) || 1));
    const t = Math.max(0, Number(total) || 0);
    return Math.round((t / p + Number.EPSILON) * 100) / 100;
  }

  function textoParcelas(parcelas, valorParc, total) {
    const p = Math.max(1, Math.floor(Number(parcelas) || 1));
    const vp = Number(valorParc) || valorParcela(total, p);
    if (p <= 1) return "À vista";
    return `${p}x de ${brl(vp)}`;
  }

  function totalVendaAtual() {
    const itens = lerItensVenda();
    const desconto = Math.max(0, Number($("venda-desconto")?.value) || 0);
    const bruto = itens.reduce((s, i) => s + i.bruto, 0);
    return Math.max(0, bruto - desconto);
  }

  function atualizarDetalhesCartaoVenda() {
    const forma = $("venda-pagamento")?.value || "";
    const box = $("venda-cartao-detalhes");
    if (!box) return;
    const mostrar = pagamentoEhCartao(forma);
    box.hidden = !mostrar;
    const selParc = $("venda-parcelas");
    if (selParc) selParc.disabled = !pagamentoEhCartaoCredito(forma);
    if (!pagamentoEhCartaoCredito(forma) && selParc) selParc.value = "1";
    const total = totalVendaAtual();
    const parcelas = Math.max(1, Math.floor(Number(selParc?.value) || 1));
    const vp = valorParcela(total, parcelas);
    const prev = $("venda-parcela-preview");
    if (prev) {
      if (!mostrar) prev.textContent = "—";
      else if (parcelas <= 1) prev.textContent = `Total no cartão: ${brl(total)}`;
      else prev.textContent = `${parcelas} parcelas de ${brl(vp)} (total ${brl(total)})`;
    }
  }

  function atualizarDetalhesCartaoSaida() {
    const forma = $("saida-pagamento")?.value || "";
    const box = $("saida-cartao-detalhes");
    if (!box) return;
    const mostrar = pagamentoEhCartao(forma);
    box.hidden = !mostrar;
    const selParc = $("saida-parcelas");
    if (selParc) selParc.disabled = !pagamentoEhCartaoCredito(forma);
    if (!pagamentoEhCartaoCredito(forma) && selParc) selParc.value = "1";
    const total = Math.max(0, Number($("saida-valor")?.value) || 0);
    const parcelas = Math.max(1, Math.floor(Number(selParc?.value) || 1));
    const vp = valorParcela(total, parcelas);
    const prev = $("saida-parcela-preview");
    if (prev) {
      if (!mostrar) prev.textContent = "—";
      else if (parcelas <= 1) prev.textContent = `Total no cartão: ${brl(total)}`;
      else prev.textContent = `${parcelas} parcelas de ${brl(vp)} (total ${brl(total)})`;
    }
  }

  function lerDetalhesCartao(prefix, total) {
    const forma = $(`${prefix}-pagamento`)?.value || "";
    if (!pagamentoEhCartao(forma)) {
      return { parcelas: 1, valorParcela: total, cartao: "" };
    }
    const parcelas = pagamentoEhCartaoCredito(forma)
      ? Math.max(1, Math.min(MAX_PARCELAS, Math.floor(Number($(`${prefix}-parcelas`)?.value) || 1)))
      : 1;
    return {
      parcelas,
      valorParcela: valorParcela(total, parcelas),
      cartao: ($(`${prefix}-cartao`)?.value || "").trim(),
    };
  }

  function limparDetalhesCartao(prefix) {
    const parc = $(`${prefix}-parcelas`);
    const cartao = $(`${prefix}-cartao`);
    if (parc) parc.value = "1";
    if (cartao) cartao.value = "";
  }

  function rotuloProjeto(p) {
    const nome = String(p.nomeObjeto || "").trim();
    return nome || p.projetoId;
  }

  function ordenarProjetos(lista) {
    return lista.slice().sort((a, b) =>
      rotuloProjeto(a).localeCompare(rotuloProjeto(b), "pt-BR", { sensitivity: "base" })
    );
  }

  function precoUnitarioProjeto(p) {
    if (p.precoSugeridoUnit > 0) return p.precoSugeridoUnit;
    const q = Math.max(1, p.quantidadePecas || 1);
    const cu = p.custoTotalUnitario || (p.custoTotal || 0) / q;
    if (cu > 0 && p.margem !== undefined) {
      return Math.round((cu * (1 + (p.margem || 0) / 100) + Number.EPSILON) * 100) / 100;
    }
    return (p.precoSugerido || 0) / q;
  }

  function custoUnitarioProjeto(p) {
    const q = Math.max(1, p.quantidadePecas || 1);
    return p.custoTotalUnitario || (p.custoTotal || 0) / q;
  }

  function optionsHtmlProjetos(selecionado) {
    let html = '<option value="">— Selecione o projeto —</option>';
    cacheProjetos.forEach((p) => {
      const precoUnit = precoUnitarioProjeto(p);
      const custoUnit = custoUnitarioProjeto(p);
      const sel = p.projetoId === selecionado ? " selected" : "";
      const rotulo = `${rotuloProjeto(p)} — ${p.projetoId} (${p.filamento || "sem filamento"})`;
      html += `<option value="${p.projetoId}"${sel} data-preco="${precoUnit}" data-custo="${custoUnit}">${rotulo} · ${brl(precoUnit)}/peça</option>`;
    });
    return html;
  }

  function criarLinhaVenda(projetoId) {
    const div = document.createElement("div");
    div.className = "venda-item";
    div.innerHTML = `
      <div class="venda-item-head">
        <strong>Projeto</strong>
        <button type="button" class="btn-remover-item" title="Remover projeto">&times;</button>
      </div>
      <select class="venda-item-projeto">${optionsHtmlProjetos(projetoId || "")}</select>
      <div class="row">
        <div>
          <label>Valor por peça (R$)</label>
          <input class="venda-item-valor" type="number" step="0.01" min="0" />
        </div>
        <div>
          <label>Quantidade</label>
          <input class="venda-item-qtd" type="number" min="1" value="1" />
        </div>
      </div>`;
    const sel = div.querySelector(".venda-item-projeto");
    sel.addEventListener("change", () => aoSelecionarProjetoLinha(div));
    div.querySelector(".venda-item-valor")?.addEventListener("input", atualizarPreviewVenda);
    div.querySelector(".venda-item-qtd")?.addEventListener("input", atualizarPreviewVenda);
    div.querySelector(".btn-remover-item")?.addEventListener("click", () => {
      const itens = document.querySelectorAll(".venda-item");
      if (itens.length <= 1) return;
      div.remove();
      atualizarPreviewVenda();
    });
    if (projetoId) aoSelecionarProjetoLinha(div);
    return div;
  }

  function aoSelecionarProjetoLinha(linha) {
    const sel = linha.querySelector(".venda-item-projeto");
    const opt = sel.options[sel.selectedIndex];
    const valor = linha.querySelector(".venda-item-valor");
    if (opt && opt.dataset.preco && valor) {
      valor.value = Number(opt.dataset.preco).toFixed(2);
    }
    atualizarPreviewVenda();
  }

  function linhasVenda() {
    return Array.from(document.querySelectorAll(".venda-item"));
  }

  function lerItensVenda() {
    return linhasVenda()
      .map((linha) => {
        const sel = linha.querySelector(".venda-item-projeto");
        const opt = sel.options[sel.selectedIndex];
        if (!sel.value) return null;
        const qtd = Math.max(1, Math.floor(Number(linha.querySelector(".venda-item-qtd")?.value) || 1));
        const precoUnit = Number(linha.querySelector(".venda-item-valor")?.value) || 0;
        const custoUnit = Number(opt.dataset.custo) || 0;
        return {
          projetoId: sel.value,
          valorUnitario: precoUnit,
          quantidadeVenda: qtd,
          custoTotal: Math.round((custoUnit * qtd + Number.EPSILON) * 100) / 100,
          bruto: precoUnit * qtd,
        };
      })
      .filter(Boolean);
  }

  function atualizarPreviewVenda() {
    const itens = lerItensVenda();
    const desconto = Math.max(0, Number($("venda-desconto")?.value) || 0);
    const bruto = itens.reduce((s, i) => s + i.bruto, 0);
    const total = Math.max(0, bruto - desconto);
    const el = $("venda-total-preview");
    if (!el) return;
    const qtdProjetos = itens.length;
    if (desconto > 0) {
      el.textContent = `Total: ${brl(total)} (${brl(bruto)} − desconto ${brl(desconto)}) · ${qtdProjetos} projeto(s)`;
    } else if (qtdProjetos > 1) {
      el.textContent = `Total da venda: ${brl(total)} · ${qtdProjetos} projetos`;
    } else if (itens.length === 1 && itens[0].quantidadeVenda > 1) {
      el.textContent = `Total: ${brl(total)} (${itens[0].quantidadeVenda} × ${brl(itens[0].valorUnitario)})`;
    } else {
      el.textContent = `Total da venda: ${brl(total)}`;
    }
    atualizarDetalhesCartaoVenda();
  }

  function renderItensVenda() {
    const box = $("venda-itens");
    if (!box) return;
    if (!linhasVenda().length) {
      box.appendChild(criarLinhaVenda());
    }
  }

  function adicionarLinhaVenda() {
    $("venda-itens")?.appendChild(criarLinhaVenda());
    atualizarPreviewVenda();
  }

  async function fetchVendas() {
    if (api().isDemo()) return [];
    const data = await api().jsonp("vendas");
    if (!data.ok) throw new Error(data.error || "Falha ao carregar vendas");
    return data.vendas || [];
  }

  async function fetchFinanceiro() {
    if (api().isDemo()) {
      return { entradas: 0, saidas: 0, saidasFixas: 0, saidasProdutos: 0, custos: 0, lucro: 0, maoDeObra: 0, caixa: 0 };
    }
    const data = await api().jsonp("financeiro");
    if (!data.ok) throw new Error(data.error || "Falha ao carregar financeiro");
    return data.resumo;
  }

  async function fetchCaixa() {
    if (api().isDemo()) return { saldo: 0 };
    const data = await api().jsonp("caixa");
    if (!data.ok) throw new Error(data.error || "Falha ao carregar caixa");
    return data.caixa;
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

  async function salvarSaldoCaixa(saldo) {
    if (api().isDemo()) {
      await new Promise((r) => setTimeout(r, 200));
      return { ok: true, demo: true };
    }
    return api().gravar({ action: "definirSaldoCaixa", saldo });
  }

  async function adicionarFilamento(payload) {
    if (api().isDemo()) {
      await new Promise((r) => setTimeout(r, 300));
      return { ok: true, demo: true };
    }
    return api().gravar({ action: "adicionarFilamento", ...payload });
  }

  async function preencherProjetosCache() {
    cacheProjetos = ordenarProjetos(await api().fetchProjetos());
    linhasVenda().forEach((linha) => {
      const sel = linha.querySelector(".venda-item-projeto");
      const atual = sel.value;
      sel.innerHTML = optionsHtmlProjetos(atual);
    });
  }

  async function registrarVenda() {
    const itens = lerItensVenda();
    if (!itens.length) {
      $("venda-msg").textContent = "Adicione ao menos um projeto.";
      $("venda-msg").className = "save-msg err";
      return;
    }
    const desconto = Math.max(0, Number($("venda-desconto").value) || 0);
    const bruto = itens.reduce((s, i) => s + i.bruto, 0);
    const total = Math.max(0, bruto - desconto);
    const cartao = lerDetalhesCartao("venda", total);
    const payload = {
      itens: itens.map((i) => ({
        projetoId: i.projetoId,
        valorUnitario: i.valorUnitario,
        quantidadeVenda: i.quantidadeVenda,
        custoTotal: i.custoTotal,
      })),
      desconto,
      formaPagamento: $("venda-pagamento").value,
      responsavelVenda: $("venda-responsavel").value,
      observacoes: $("venda-obs").value.trim(),
      parcelas: cartao.parcelas,
      valorParcela: cartao.valorParcela,
      cartao: cartao.cartao,
    };
    $("btn-registrar-venda").disabled = true;
    $("venda-msg").textContent = "Salvando…";
    try {
      const resp = await gravarVenda(payload);
      if (resp && resp.ok) {
        const vid = resp.resultado?.vendaId || "";
        $("venda-msg").textContent = resp.demo
          ? "Venda simulada (demo)."
          : `Venda registrada!${vid ? " ID: " + vid : ""}`;
        $("venda-msg").className = "save-msg ok";
        $("venda-obs").value = "";
        $("venda-desconto").value = "0";
        limparDetalhesCartao("venda");
        atualizarDetalhesCartaoVenda();
        $("venda-itens").innerHTML = "";
        renderItensVenda();
        atualizarPreviewVenda();
        await carregarVendas();
        await atualizarFinanceiro();
        await carregarCaixa();
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
    const tipo = $("saida-tipo").value;
    const pagamento = $("saida-pagamento").value;
    if (!desc || valor <= 0) {
      $("saida-msg").textContent = "Informe descrição e valor.";
      $("saida-msg").className = "save-msg err";
      return;
    }
    const cartao = lerDetalhesCartao("saida", valor);
    try {
      const resp = await gravarSaida({
        descricao: desc,
        valor,
        tipo,
        pagamento,
        parcelas: cartao.parcelas,
        valorParcela: cartao.valorParcela,
        cartao: cartao.cartao,
      });
      if (resp && resp.ok) {
        $("saida-desc").value = "";
        $("saida-valor").value = "";
        limparDetalhesCartao("saida");
        atualizarDetalhesCartaoSaida();
        $("saida-msg").textContent = "Pagamento registrado!";
        $("saida-msg").className = "save-msg ok";
        await carregarSaidas();
        await atualizarFinanceiro();
        await carregarCaixa();
      }
    } catch (e) {
      $("saida-msg").textContent = "Falha: " + e.message;
      $("saida-msg").className = "save-msg err";
    }
  }

  async function salvarCaixa() {
    const saldo = Number($("caixa-saldo").value) || 0;
    $("btn-salvar-caixa").disabled = true;
    try {
      const resp = await salvarSaldoCaixa(saldo);
      if (resp && resp.ok) {
        $("caixa-msg").textContent = resp.demo ? "Saldo simulado (demo)." : "Saldo atualizado!";
        $("caixa-msg").className = "save-msg ok";
        await atualizarFinanceiro();
      }
    } catch (e) {
      $("caixa-msg").textContent = "Falha: " + e.message;
      $("caixa-msg").className = "save-msg err";
    } finally {
      $("btn-salvar-caixa").disabled = false;
    }
  }

  function toggleCaixa() {
    caixaVisivel = !caixaVisivel;
    const panel = $("caixa-panel");
    const btn = $("btn-toggle-caixa");
    if (panel) panel.hidden = !caixaVisivel;
    if (btn) btn.classList.toggle("active", caixaVisivel);
    if (caixaVisivel) carregarCaixa();
  }

  async function carregarCaixa() {
    try {
      const c = await fetchCaixa();
      if ($("caixa-saldo")) $("caixa-saldo").value = Number(c.saldo || 0).toFixed(2);
    } catch {
      /* ignore */
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
        const parcelasTxt = pagamentoEhCartao(v.formaPagamento)
          ? textoParcelas(v.parcelas, v.valorParcela, v.valorVenda)
          : "—";
        tr.innerHTML = [
          v.data,
          v.vendaId || "—",
          v.projetoId,
          brl(v.valorVenda),
          v.desconto > 0 ? brl(v.desconto) : "—",
          v.formaPagamento,
          parcelasTxt,
          v.cartao || "—",
          v.responsavelVenda,
          v.responsavelProjeto || "",
          v.observacoes || "",
          brl(v.lucro || 0),
        ]
          .map((c) => `<td>${c}</td>`)
          .join("");
        body.appendChild(tr);
      });
      if (info) info.textContent = lista.length ? `${lista.length} linha(s) de venda.` : "Nenhuma venda ainda.";
    } catch (e) {
      if (info) info.textContent = "Erro: " + e.message;
    }
  }

  async function carregarSaidas() {
    const bodyFixas = $("saidas-fixas-body");
    const bodyProd = $("saidas-produtos-body");
    if (!bodyFixas || !bodyProd) return;
    try {
      const lista = await fetchSaidas();
      bodyFixas.innerHTML = "";
      bodyProd.innerHTML = "";
      lista.forEach((s) => {
        const tr = document.createElement("tr");
        const parcelasTxt = pagamentoEhCartao(s.pagamento)
          ? textoParcelas(s.parcelas, s.valorParcela, s.valor)
          : "—";
        tr.innerHTML = `<td>${s.data}</td><td>${s.descricao}</td><td>${brl(s.valor)}</td><td>${s.pagamento || "—"}</td><td>${parcelasTxt}</td><td>${s.cartao || "—"}</td>`;
        if (String(s.tipo) === "Produto") {
          bodyProd.appendChild(tr);
        } else {
          bodyFixas.appendChild(tr);
        }
      });
    } catch {
      /* ignore */
    }
  }

  function renderChart(resumo) {
    const canvas = $("chart-financeiro");
    if (!canvas || typeof window.Chart === "undefined") return;
    const dados = {
      labels: ["Entradas", "Fixos empresa", "Produtos", "Custos", "Lucro"],
      datasets: [
        {
          label: "R$",
          data: [
            resumo.entradas || 0,
            resumo.saidasFixas || 0,
            resumo.saidasProdutos || 0,
            resumo.custos || 0,
            resumo.lucro || 0,
          ],
          backgroundColor: ["#22c55e", "#ef4444", "#f97316", "#f59e0b", "#8b5cf6"],
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
        const caixaHtml = caixaVisivel
          ? `<div class="fin-card highlight"><small>Caixa (dinheiro)</small><b>${brl(r.caixa || 0)}</b></div>`
          : "";
        box.innerHTML = `
          ${caixaHtml}
          <div class="fin-card"><small>Entradas (vendas)</small><b>${brl(r.entradas)}</b></div>
          <div class="fin-card"><small>Fixos empresa</small><b>${brl(r.saidasFixas || 0)}</b></div>
          <div class="fin-card"><small>Pag. produtos</small><b>${brl(r.saidasProdutos || 0)}</b></div>
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
    optsPagamento($("saida-pagamento"));
    preencherOptsParcelas($("venda-parcelas"));
    preencherOptsParcelas($("saida-parcelas"));

    renderItensVenda();
    $("btn-add-venda-item")?.addEventListener("click", adicionarLinhaVenda);
    $("venda-desconto")?.addEventListener("input", atualizarPreviewVenda);
    $("venda-pagamento")?.addEventListener("change", atualizarDetalhesCartaoVenda);
    $("venda-parcelas")?.addEventListener("change", atualizarDetalhesCartaoVenda);
    $("saida-pagamento")?.addEventListener("change", atualizarDetalhesCartaoSaida);
    $("saida-parcelas")?.addEventListener("change", atualizarDetalhesCartaoSaida);
    $("saida-valor")?.addEventListener("input", atualizarDetalhesCartaoSaida);
    $("btn-registrar-venda")?.addEventListener("click", registrarVenda);
    $("btn-registrar-saida")?.addEventListener("click", registrarSaida);
    $("btn-salvar-filamento")?.addEventListener("click", salvarFilamentoNovo);
    $("btn-toggle-caixa")?.addEventListener("click", toggleCaixa);
    $("btn-salvar-caixa")?.addEventListener("click", salvarCaixa);
    $("btn-recarregar-vendas")?.addEventListener("click", async () => {
      await preencherProjetosCache();
      await carregarVendas();
      await carregarSaidas();
      await atualizarFinanceiro();
      if (caixaVisivel) await carregarCaixa();
    });
  }

  async function onShowVendas() {
    await preencherProjetosCache();
    await carregarVendas();
    await carregarSaidas();
    await atualizarFinanceiro();
  }

  window.TNJVendas = { initVendas, onShowVendas };
})();
