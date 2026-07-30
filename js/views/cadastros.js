/* Abertura dos modais de cadastro E edição. Cada função aceita um
   registro existente (opcional): se vier, o modal abre em modo
   edição (pré-preenchido) e grava via update; senão, cria via add.

   Após gravar, dispara "data-changed" para a tela atual se re-renderizar. */

import { store } from "../data/store.js";
import { esc, formatAno } from "../ui/dom.js";
import {
  openModal, fieldText, fieldTextarea, fieldSelect, fieldTags,
  hydrateTags, readTags, readValue,
} from "../ui/modal.js";

function avisarMudanca() {
  window.dispatchEvent(new CustomEvent("data-changed"));
}

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function isoParaBR(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}
function brParaISO(br) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br || "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}
// extrai o valor numérico de uma capacidade livre existente (ex.: "8TB" → "8")
function capacidadeParaNumero(str) {
  const m = /([\d.,]+)/.exec(str || "");
  return m ? m[1].replace(",", ".") : "";
}

/* ---------------- Projeto (criar / editar) ---------------- */
export async function abrirNovoProjeto(existente = null) {
  const listas = await store.getListas();
  const ed = !!existente;
  const p = existente || {};
  openModal({
    title: ed ? "Editar projeto" : "Novo projeto",
    submitLabel: ed ? "Salvar alterações" : "Criar projeto",
    bodyHtml: `
      ${fieldText("nome", "Nome do projeto", { required: true, value: p.nome || "", placeholder: "Ex.: Imortais" })}
      <div class="field-2col">
        ${fieldText("ano", "Ano", { type: "number", value: p.ano && p.ano !== 1900 ? p.ano : "", placeholder: "Deixe em branco se não souber" })}
        ${fieldSelect("statusProjeto", "Status", listas.statusProjeto, { value: p.statusProjeto || listas.statusProjeto[0]?.valor })}
      </div>
      <div class="field-2col">
        ${fieldSelect("atividadeAtual", "Atividade atual", listas.atividadeAtual, { value: p.atividadeAtual || listas.atividadeAtual[0] })}
        ${fieldSelect("alfred", "ALFRED", listas.alfred, { value: p.alfred || listas.alfred[0] })}
      </div>
      ${fieldTags("lto", "LTO", { hint: "Códigos de LTO deste projeto (entrada direta).", placeholder: "Ex.: LTO-014" })}
      <div class="field-hint">Localizações e última atualização são automáticas — não aparecem aqui.</div>
    `,
    onMount: (form) => hydrateTags(form, "lto", p.lto || []),
    onSubmit: async (form) => {
      const nome = readValue(form, "nome");
      if (!nome) throw new Error("Informe o nome do projeto.");
      const campos = {
        nome,
        ano: Number(readValue(form, "ano")) || 1900,
        statusProjeto: readValue(form, "statusProjeto"),
        atividadeAtual: readValue(form, "atividadeAtual"),
        alfred: readValue(form, "alfred"),
        lto: readTags(form, "lto"),
      };
      if (ed) await store.updateProjeto(p.id, campos);
      else await store.addProjeto(campos);
      avisarMudanca();
    },
  });
}

/* ---------------- Mídia (criar / editar) ---------------- */
export async function abrirNovaMidia(existente = null, { projetoIdFixo = null } = {}) {
  const ed = !!existente;
  const m = existente || {};
  const [listas, projetos, estruturaExistente] = await Promise.all([
    store.getListas(),
    store.listProjetos(),
    ed ? store.estruturaDaMidia(m.id) : Promise.resolve([]),
  ]);
  projetos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const itens = projetos.map((p) => ({ value: p.id, label: `${p.nome} (${formatAno(p.ano)})` }));
  const projetoFixo = !ed && projetoIdFixo ? projetos.find((p) => p.id === projetoIdFixo) : null;
  openModal({
    title: ed ? "Editar mídia" : "Nova mídia",
    subtitle: projetoFixo ? `Já vinculada a ${projetoFixo.nome}` : "",
    submitLabel: ed ? "Salvar alterações" : "Criar mídia",
    bodyHtml: `
      ${fieldText("nome", "Nome da mídia", { required: true, value: m.nome || "", placeholder: "Ex.: HD_IMORTAIS_03" })}
      <div class="field-2col">
        ${fieldSelect("tipo", "Tipo", listas.tipoMidia, { value: m.tipo || listas.tipoMidia[0] })}
        ${fieldText("capacidade", "Capacidade (TB)", { type: "number", value: capacidadeParaNumero(m.capacidade), placeholder: "Ex.: 8" })}
      </div>
      <div class="field-2col">
        ${fieldSelect("statusMidia", "Status", listas.statusMidia, { value: m.statusMidia || listas.statusMidia[0]?.valor })}
        ${fieldSelect("local", "Onde está", ["", ...listas.locais], { value: m.local || "" })}
      </div>
      <div class="field">
        <label>Projetos armazenados</label>
        <div class="field-hint" style="margin-bottom:6px">Marque os projetos e descreva o conteúdo de cada um nesta mídia.</div>
        <div id="proj-conteudo-lista"></div>
      </div>
      <div class="field">
        <label>Estrutura de pastas <span style="font-weight:400;color:var(--text-faint);font-size:12px">— opcional</span></label>
        <div class="field-hint" style="margin-bottom:6px">Pastas desta mídia por projeto. Detalhes como resumo e LTO podem ser editados depois na página do projeto.</div>
        <div id="est-lista"></div>
        <button type="button" id="est-add-btn" class="btn btn-ghost" style="width:100%;margin-top:6px;font-size:12px">+ Adicionar pasta</button>
      </div>
      ${fieldTextarea("observacoes", "Observações", { value: m.conteudo || "", hint: "Observações gerais sobre esta mídia." })}
    `,
    onMount: (form) => {
      const lista = form.querySelector("#proj-conteudo-lista");
      const marcados = new Set(m.projetosArmazenados || []);
      if (projetoFixo) marcados.add(projetoFixo.id);
      const state = { ...(m.conteudoPorProjeto || {}) };
      const estLista = form.querySelector("#est-lista");
      const deletedIds = new Set();

      function projetoOptsHtml(selectedPid) {
        return [...marcados].map((pid) => {
          const it = itens.find((x) => x.value === pid);
          return it ? `<option value="${esc(pid)}" ${pid === selectedPid ? "selected" : ""}>${esc(it.label)}</option>` : "";
        }).join("");
      }
      function tipoOptsHtml(selected) {
        return (listas.tipoMaterial || []).map((t) =>
          `<option value="${esc(t)}" ${t === selected ? "selected" : ""}>${esc(t)}</option>`
        ).join("");
      }

      function atualizarEstProj() {
        estLista.querySelectorAll(".est-proj").forEach((sel) => {
          const cur = sel.value;
          sel.innerHTML = projetoOptsHtml(cur);
          if (!sel.value && marcados.size > 0) sel.value = [...marcados][0];
        });
      }

      function salvarValores() {
        lista.querySelectorAll("input[data-pid]").forEach((inp) => {
          state[inp.dataset.pid] = inp.value;
        });
      }

      function desenhar() {
        salvarValores();
        lista.innerHTML = "";
        itens.forEach((it) => {
          const checked = marcados.has(it.value);
          const row = document.createElement("div");
          row.className = "proj-conteudo-row";
          row.innerHTML = `<label class="proj-cb"><input type="checkbox" name="projetosArmazenados" value="${esc(it.value)}" ${checked ? "checked" : ""}/> ${esc(it.label)}</label>
            ${checked ? `<input type="text" data-pid="${esc(it.value)}" value="${esc(state[it.value] || "")}" placeholder="Conteúdo nesta mídia…" class="proj-conteudo-input" />` : ""}`;
          lista.appendChild(row);
          row.querySelector("input[type=checkbox]").addEventListener("change", (e) => {
            if (e.target.checked) marcados.add(it.value);
            else marcados.delete(it.value);
            desenhar();
          });
        });
        if (!itens.length) {
          lista.innerHTML = '<div class="empty" style="padding:14px">Nenhum projeto cadastrado ainda.</div>';
        }
        atualizarEstProj();
      }
      desenhar();

      form._getProjetosArmazenados = () => [...marcados];
      form._getConteudoPorProjeto = () => {
        salvarValores();
        const result = {};
        marcados.forEach((pid) => {
          const v = state[pid];
          if (v && v.trim()) result[pid] = v.trim();
        });
        return result;
      };

      function addEstRow({ id = "", projetoId = "", caminho = "", tipoMaterial = "" } = {}) {
        if (!projetoId && marcados.size > 0) projetoId = [...marcados][0];
        if (!tipoMaterial) tipoMaterial = (listas.tipoMaterial || [])[0] || "";
        const row = document.createElement("div");
        row.className = "est-form-row";
        if (id) row.dataset.estId = id;
        row.innerHTML = `
          <div class="est-form-row-top">
            <select class="est-proj">${projetoOptsHtml(projetoId)}</select>
            <button type="button" class="est-del-btn" title="Remover">✕</button>
          </div>
          <input class="est-caminho" type="text" value="${esc(caminho)}" placeholder="Caminho da pasta…" title="${esc(caminho)}">
          <div class="est-form-row-sub">
            <select class="est-tipo">${tipoOptsHtml(tipoMaterial)}</select>
          </div>
        `;
        row.querySelector(".est-del-btn").addEventListener("click", () => {
          if (id) deletedIds.add(id);
          row.remove();
        });
        row.querySelector(".est-caminho").addEventListener("input", (ev) => {
          ev.target.title = ev.target.value;
        });
        estLista.appendChild(row);
      }

      for (const e of estruturaExistente) {
        addEstRow({ id: e.id, projetoId: e.projetoId, caminho: e.caminho, tipoMaterial: e.tipoMaterial });
      }

      form.querySelector("#est-add-btn").addEventListener("click", () => addEstRow());

      form._getEstruturaRows = () => {
        const rows = [];
        estLista.querySelectorAll(".est-form-row").forEach((row) => {
          const cam = row.querySelector(".est-caminho").value.trim();
          if (!cam) return;
          rows.push({
            id: row.dataset.estId || null,
            projetoId: row.querySelector(".est-proj").value,
            caminho: cam,
            tipoMaterial: row.querySelector(".est-tipo").value,
          });
        });
        return rows;
      };
      form._getDeletedEstruturaIds = () => [...deletedIds];
    },
    onSubmit: async (form) => {
      const nome = readValue(form, "nome");
      if (!nome) throw new Error("Informe o nome da mídia.");
      const capacidadeNum = readValue(form, "capacidade");
      const campos = {
        nome,
        tipo: readValue(form, "tipo"),
        capacidade: capacidadeNum ? `${capacidadeNum}TB` : "",
        statusMidia: readValue(form, "statusMidia"),
        local: readValue(form, "local"),
        projetosArmazenados: form._getProjetosArmazenados(),
        conteudo: readValue(form, "observacoes"),
        conteudoPorProjeto: form._getConteudoPorProjeto(),
      };

      let midiaId;
      if (ed) {
        await store.updateMidia(m.id, campos);
        midiaId = m.id;
      } else {
        const nova = await store.addMidia(campos);
        midiaId = nova.id;
      }

      for (const id of form._getDeletedEstruturaIds()) {
        await store.removeEstrutura(id);
      }
      for (const row of form._getEstruturaRows()) {
        const dadosEst = { projetoId: row.projetoId, midiaId, caminho: row.caminho, tipoMaterial: row.tipoMaterial };
        if (row.id) await store.updateEstrutura(row.id, dadosEst);
        else await store.addEstrutura(dadosEst);
      }

      avisarMudanca();
    },
  });
}

/* ---------------- Estrutura / pasta (criar / editar) ---------------- */
// { projetoIdFixo } → vindo da página do projeto (mostra seletor de mídia)
// { midiaIdFixo }   → vindo da página da mídia  (mostra seletor de projeto)
// existente         → registro a editar (preenche tudo)
export async function abrirNovaEstrutura({ projetoIdFixo = null, midiaIdFixo = null } = {}, existente = null) {
  const [listas, projetos, midias] = await Promise.all([
    store.getListas(), store.listProjetos(), store.listMidias(),
  ]);
  projetos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const ed = !!existente;
  const e = existente || {};

  const projetoIdInicial = projetoIdFixo || e.projetoId || projetos[0]?.id;
  const midiaIdInicial = midiaIdFixo || e.midiaId || "";

  // subtitle contextual
  let subtitle = "";
  if (projetoIdFixo) {
    const p = projetos.find((x) => x.id === projetoIdFixo);
    subtitle = ed ? `Estrutura de ${p?.nome}` : `Adicionando à estrutura de ${p?.nome}`;
  } else if (midiaIdFixo) {
    const m = midias.find((x) => x.id === midiaIdFixo);
    subtitle = ed ? `Estrutura de ${m?.nome}` : `Adicionando à ${m?.nome}`;
  }

  // seletor de projeto (se não fixo)
  const seletorProjeto = projetoIdFixo ? "" : (() => {
    const lista = midiaIdFixo
      ? projetos.filter((p) => { const m = midias.find((x) => x.id === midiaIdFixo); return m && (m.projetosArmazenados || []).includes(p.id); })
      : projetos;
    return `<div class="field"><label for="f_projetoId">Projeto</label>
      <select id="f_projetoId" name="projetoId">
        ${lista.map((p) => `<option value="${esc(p.id)}" ${p.id === projetoIdInicial ? "selected" : ""}>${esc(p.nome)} (${formatAno(p.ano)})</option>`).join("")}
      </select></div>`;
  })();

  // seletor de mídia (se não fixo)
  const seletorMidia = midiaIdFixo ? "" : (() => {
    const lista = projetoIdFixo
      ? midias.filter((m) => (m.projetosArmazenados || []).includes(projetoIdFixo))
      : midias;
    return `<div class="field"><label for="f_midiaId">Mídia</label>
      <select id="f_midiaId" name="midiaId">
        <option value="">— Nenhuma —</option>
        ${lista.map((m) => `<option value="${esc(m.id)}" ${m.id === midiaIdInicial ? "selected" : ""}>${esc(m.nome)} (${esc(m.tipo)})</option>`).join("")}
      </select></div>`;
  })();

  openModal({
    title: ed ? "Editar pasta" : "Nova pasta",
    subtitle,
    submitLabel: ed ? "Salvar alterações" : "Adicionar pasta",
    bodyHtml: `
      ${seletorProjeto}
      ${seletorMidia}
      ${fieldText("caminho", "Caminho", { required: true, value: e.caminho || "", placeholder: "Ex.: NOME_DO_HD/BRUTO" })}
      ${fieldSelect("tipoMaterial", "Tipo de material", listas.tipoMaterial, { value: e.tipoMaterial || listas.tipoMaterial[0] })}
      ${fieldText("resumo", "Resumo", { value: e.resumo || "", placeholder: "Ex.: Diárias D01 até D22" })}
      ${fieldText("arquivadoLto", "Arquivado em LTO (opcional)", { value: e.arquivadoLto || "", placeholder: "Ex.: LTO-009" })}
    `,
    onSubmit: async (form) => {
      const caminho = readValue(form, "caminho");
      if (!caminho) throw new Error("Informe o caminho da pasta.");
      const campos = {
        projetoId: projetoIdFixo || readValue(form, "projetoId"),
        midiaId: midiaIdFixo || readValue(form, "midiaId"),
        caminho,
        tipoMaterial: readValue(form, "tipoMaterial"),
        resumo: readValue(form, "resumo"),
        arquivadoLto: readValue(form, "arquivadoLto"),
      };
      if (ed) await store.updateEstrutura(e.id, campos);
      else await store.addEstrutura(campos);
      avisarMudanca();
    },
  });
}

/* ---------------- Histórico (criar / editar) ---------------- */
// projetoIdFixo: trava o seletor quando vem de dentro de um projeto.
// responsavelFixo: trava o seletor quando vem de dentro da aba Equipe.
// existente: registro a editar.
export async function abrirNovoHistorico({ projetoIdFixo = null, responsavelFixo = null } = {}, existente = null) {
  const [listas, projetos] = await Promise.all([store.getListas(), store.listProjetos()]);
  projetos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const ed = !!existente;
  const h = existente || {};
  const projetoSel = projetoIdFixo || h.projetoId || "";
  const seletorProjeto = projetoIdFixo
    ? ""
    : `<div class="field"><label for="f_projetoId">Projeto</label>
        <select id="f_projetoId" name="projetoId">
          <option value="">— Geral (sem projeto) —</option>
          ${projetos.map((p) => `<option value="${esc(p.id)}" ${p.id === projetoSel ? "selected" : ""}>${esc(p.nome)} (${formatAno(p.ano)})</option>`).join("")}
        </select></div>`;

  const responsavelSel = responsavelFixo || h.responsavel || "";
  const seletorResponsavel = responsavelFixo
    ? ""
    : `<div class="field"><label for="f_responsavel">Responsável</label>
        <select id="f_responsavel" name="responsavel">
          <option value="">— Sem responsável —</option>
          ${(listas.responsaveis || []).map((r) => `<option value="${esc(r)}" ${r === responsavelSel ? "selected" : ""}>${esc(r)}</option>`).join("")}
        </select></div>`;

  const TIPOS = [
    { k: "dia", label: "Dia" },
    { k: "intervalo", label: "Intervalo" },
    { k: "mes", label: "Mês" },
    { k: "semana", label: "Semana" },
  ];
  const tipoInicial = h.periodoTipo || "dia";

  const subtitlePartes = [];
  if (projetoIdFixo) subtitlePartes.push(projetos.find((p) => p.id === projetoIdFixo)?.nome || "");
  if (responsavelFixo) subtitlePartes.push(responsavelFixo);

  openModal({
    title: ed ? "Editar histórico" : "Novo histórico",
    subtitle: subtitlePartes.length ? `Registro para ${subtitlePartes.join(" · ")}` : "",
    submitLabel: ed ? "Salvar alterações" : "Registrar",
    bodyHtml: `
      ${seletorProjeto}
      ${seletorResponsavel}
      <div class="field">
        <label>Período</label>
        <div class="segmented" data-seg="periodoTipo">
          ${TIPOS.map((t) => `<button type="button" data-k="${t.k}" class="${t.k === tipoInicial ? "active" : ""}">${t.label}</button>`).join("")}
        </div>
      </div>
      <div class="field" id="slot-periodo"></div>
      ${fieldSelect("acao", "Ação", listas.acao, { value: h.acao || listas.acao[0] })}
      ${fieldTextarea("observacoes", "Observações", { value: h.observacoes || "" })}
    `,
    onMount: (form) => {
      let tipo = tipoInicial;
      const slot = form.querySelector("#slot-periodo");
      const seg = form.querySelector('[data-seg="periodoTipo"]');

      function desenhaCampo(valorInicial = "") {
        if (tipo === "dia") {
          const iso = valorInicial && /^\d{4}-\d{2}-\d{2}$/.test(valorInicial)
            ? valorInicial : brParaISO(valorInicial) || hojeISO();
          slot.innerHTML = `<label for="f_periodo">Data</label><input type="date" id="f_periodo" name="periodo" value="${iso}" />`;
        } else {
          const ph = { intervalo: "Ex.: 16–20/06/2026", mes: "Ex.: Junho/2026", semana: "Ex.: Semana 24" }[tipo];
          slot.innerHTML = `<label for="f_periodo">Período (${tipo})</label><input type="text" id="f_periodo" name="periodo" value="${esc(valorInicial)}" placeholder="${ph}" />`;
        }
      }
      // valor inicial: em edição, usa o período salvo
      desenhaCampo(ed ? (tipo === "dia" ? (brParaISO(h.periodo) || h.periodo) : h.periodo) : "");

      seg.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-k]");
        if (!b) return;
        tipo = b.dataset.k;
        seg.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
        desenhaCampo();
      });
      form._getTipo = () => tipo;
    },
    onSubmit: async (form) => {
      const tipo = form._getTipo();
      const raw = readValue(form, "periodo");
      if (!raw) throw new Error("Informe o período.");
      const periodo = tipo === "dia" ? isoParaBR(raw) : raw;
      const data = tipo === "dia" && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : hojeISO();
      const campos = {
        projetoId: projetoIdFixo || readValue(form, "projetoId"),
        responsavel: responsavelFixo || readValue(form, "responsavel"),
        periodoTipo: tipo,
        periodo,
        acao: readValue(form, "acao"),
        observacoes: readValue(form, "observacoes"),
        data,
      };
      if (ed) await store.updateHistorico(h.id, campos);
      else await store.addHistorico(campos);
      avisarMudanca();
    },
  });
}

/* ---------------- Fita (criar / editar) ---------------- */
export async function abrirNovaFita(existente = null) {
  const [listas, projetos] = await Promise.all([store.getListas(), store.listProjetos()]);
  projetos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const ed = !!existente;
  const f = existente || {};
  const tipos = listas.tipoFita || ["Betacam 30", "Betacam 60", "Mini DV"];
  const statuses = listas.statusFita || [{ valor: "Não catalogada", cor: "gray" }];
  const locais = listas.locaisFita || [];

  openModal({
    title: ed ? "Editar fita" : "Nova fita",
    submitLabel: ed ? "Salvar alterações" : "Cadastrar fita",
    bodyHtml: `
      ${fieldText("codigo", "Código / etiqueta", { required: true, value: f.codigo || "", placeholder: "Ex.: BETA-001" })}
      <div class="field-2col">
        ${fieldSelect("tipo", "Tipo", tipos, { value: f.tipo || tipos[0] })}
        ${fieldSelect("statusFita", "Status", statuses, { value: f.statusFita || statuses[0]?.valor || statuses[0] })}
      </div>
      <div class="field-2col">
        ${fieldSelect("localFisico", "Local físico", ["", ...locais], { value: f.localFisico || "" })}
        <div class="field">
          <label for="f_projetoId">Projeto vinculado</label>
          <select id="f_projetoId" name="projetoId">
            <option value="">— Nenhum / não identificado —</option>
            ${projetos.map((p) => `<option value="${esc(p.id)}" ${p.id === f.projetoId ? "selected" : ""}>${esc(p.nome)} (${formatAno(p.ano)})</option>`).join("")}
          </select>
        </div>
      </div>
      ${fieldText("projetoNome", "Nome do projeto (se não cadastrado)", { value: f.projetoNome || "", placeholder: "Ex.: Documentário XYZ" })}
      ${fieldTextarea("observacoes", "Observações", { value: f.observacoes || "", placeholder: "Conteúdo, estado da fita, anotações…" })}
    `,
    onSubmit: async (form) => {
      const codigo = readValue(form, "codigo");
      if (!codigo) throw new Error("Informe o código da fita.");
      const campos = {
        codigo,
        tipo: readValue(form, "tipo"),
        statusFita: readValue(form, "statusFita"),
        localFisico: readValue(form, "localFisico"),
        projetoId: readValue(form, "projetoId"),
        projetoNome: readValue(form, "projetoNome"),
        observacoes: readValue(form, "observacoes"),
      };
      if (ed) await store.updateFita(f.id, campos);
      else await store.addFita(campos);
      avisarMudanca();
    },
  });
}

/* ---------------- Fitas em lote ---------------- */
export async function abrirLoteFitas() {
  const [listas, projetos] = await Promise.all([store.getListas(), store.listProjetos()]);
  projetos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const tipos = listas.tipoFita || ["Betacam 30", "Betacam 60", "Mini DV"];
  const statuses = listas.statusFita || [{ valor: "Não catalogada", cor: "gray" }];
  const locais = listas.locaisFita || [];

  openModal({
    title: "Cadastro em lote",
    submitLabel: "Cadastrar fitas",
    bodyHtml: `
      <div class="field-hint" style="margin-bottom:14px">Informe o prefixo e o intervalo numérico. Ex.: prefixo <strong>BETA30-</strong>, de <strong>1</strong> a <strong>50</strong> gera BETA30-001 até BETA30-050.</div>
      ${fieldText("prefixo", "Prefixo do código", { required: true, placeholder: "Ex.: BETA30-" })}
      <div class="field-2col">
        ${fieldText("de", "De (número)", { type: "number", required: true, value: "1" })}
        ${fieldText("ate", "Até (número)", { type: "number", required: true, placeholder: "Ex.: 50" })}
      </div>
      <div class="field-2col">
        ${fieldSelect("tipo", "Tipo", tipos, { value: tipos[0] })}
        ${fieldSelect("statusFita", "Status", statuses, { value: statuses[0]?.valor || statuses[0] })}
      </div>
      <div class="field-2col">
        ${fieldSelect("localFisico", "Local físico", ["", ...locais], { value: "" })}
        <div class="field">
          <label for="f_projetoId">Projeto vinculado</label>
          <select id="f_projetoId" name="projetoId">
            <option value="">— Nenhum / não identificado —</option>
            ${projetos.map((p) => `<option value="${esc(p.id)}">${esc(p.nome)} (${formatAno(p.ano)})</option>`).join("")}
          </select>
        </div>
      </div>
      ${fieldText("projetoNome", "Nome do projeto (se não cadastrado)", { placeholder: "Ex.: Documentário XYZ" })}
      ${fieldTextarea("observacoes", "Observações", { placeholder: "Conteúdo, estado das fitas, anotações…" })}
    `,
    onSubmit: async (form) => {
      const prefixo = readValue(form, "prefixo");
      if (!prefixo) throw new Error("Informe o prefixo.");
      const de = parseInt(readValue(form, "de"), 10);
      const ate = parseInt(readValue(form, "ate"), 10);
      if (isNaN(de) || isNaN(ate) || ate < de) throw new Error("Intervalo inválido.");
      if (ate - de + 1 > 500) throw new Error("Máximo de 500 fitas por lote.");
      const tipo = readValue(form, "tipo");
      const statusFita = readValue(form, "statusFita");
      const localFisico = readValue(form, "localFisico");
      const projetoId = readValue(form, "projetoId");
      const projetoNome = readValue(form, "projetoNome");
      const observacoes = readValue(form, "observacoes");
      const pad = String(ate).length;
      for (let i = de; i <= ate; i++) {
        await store.addFita({
          codigo: prefixo + String(i).padStart(pad, "0"),
          tipo, statusFita, localFisico,
          projetoId, projetoNome, observacoes,
        });
      }
      avisarMudanca();
    },
  });
}

/* ---------------- Pendência (criar / editar) ---------------- */
export async function abrirNovaDemanda(projetoIdFixo = null, existente = null) {
  const [listas, projetos] = await Promise.all([store.getListas(), store.listProjetos()]);
  projetos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const ed = !!existente;
  const d = existente || {};
  const projetoSel = projetoIdFixo || d.projetoId || "";
  const seletorProjeto = projetoIdFixo
    ? ""
    : `<div class="field"><label for="f_projetoId">Projeto</label>
        <select id="f_projetoId" name="projetoId">
          <option value="">— Geral (sem projeto) —</option>
          ${projetos.map((p) => `<option value="${esc(p.id)}" ${p.id === projetoSel ? "selected" : ""}>${esc(p.nome)} (${formatAno(p.ano)})</option>`).join("")}
        </select></div>`;

  openModal({
    title: ed ? "Editar pendência" : "Nova pendência",
    subtitle: projetoIdFixo ? `Para ${projetos.find((p) => p.id === projetoIdFixo)?.nome || ""}` : "",
    submitLabel: ed ? "Salvar alterações" : "Criar pendência",
    bodyHtml: `
      ${seletorProjeto}
      ${fieldText("pendencia", "Pendência", { required: true, value: d.pendencia || "", placeholder: "Descreva a tarefa" })}
      <div class="field-2col">
        ${fieldSelect("prioridade", "Prioridade", listas.prioridade, { value: d.prioridade || "Média" })}
        ${fieldSelect("responsavel", "Responsável", listas.responsaveis, { value: d.responsavel || listas.responsaveis[0] })}
      </div>
      ${fieldSelect("status", "Status", listas.statusDemanda, { value: d.status || listas.statusDemanda[0]?.valor })}
    `,
    onSubmit: async (form) => {
      const pendencia = readValue(form, "pendencia");
      if (!pendencia) throw new Error("Descreva a pendência.");
      const campos = {
        projetoId: projetoIdFixo || readValue(form, "projetoId"),
        pendencia,
        prioridade: readValue(form, "prioridade"),
        responsavel: readValue(form, "responsavel"),
        status: readValue(form, "status"),
      };
      if (ed) await store.updateDemanda(d.id, campos);
      else await store.addDemanda(campos);
      avisarMudanca();
    },
  });
}
