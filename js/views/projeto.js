/* Detalhe do Projeto — tudo sobre um projeto numa tela só:
   dados mestre, Mídias (em ícones — a estrutura de pastas de cada uma
   fica na tela da própria mídia), Fitas, Histórico, Pendências.
   Inclui editar/excluir do projeto e de cada item das listas. */

import { store } from "../data/store.js";
import { esc, formatAno, ordenarDemandas, compararNomes } from "../ui/dom.js";
import { badgeFromLista } from "../ui/badges.js";
import { iconeMidia } from "../ui/icons.js";
import { abrirNovoProjeto, abrirNovaMidia, abrirNovoHistorico, abrirNovaDemanda } from "./cadastros.js";

export async function renderProjeto(app, id) {
  const projeto = await store.getProjeto(id);
  if (!projeto) {
    app.innerHTML = `<a class="back-link" href="#/">← Voltar</a>
      <div class="empty">Projeto não encontrado.</div>`;
    return;
  }

  const [listas, midias, historico, demandasBrutas, fitas] = await Promise.all([
    store.getListas(),
    store.midiasDoProjeto(id),
    store.historicoDoProjeto(id),
    store.demandasDoProjeto(id),
    store.fitasDoProjeto(id),
  ]);
  const demandas = ordenarDemandas(demandasBrutas, listas.prioridade);

  const totalTB = midias.filter((m) => m.tipo !== "LTO").reduce((s, m) => s + parseTB(m.capacidade), 0);
  const totalLTO = midias.filter((m) => m.tipo === "LTO").reduce((s, m) => s + parseTB(m.capacidade), 0);
  const totalTexto = fmtTB(totalTB) + (totalLTO ? ` + ${fmtTB(totalLTO)} em LTO` : "");

  app.innerHTML = `
    <a class="back-link" href="#/">← Voltar para projetos</a>

    <div class="detail-head">
      <div>
        <h1 class="page-title">${esc(projeto.nome)}</h1>
        <div class="page-sub">${esc(formatAno(projeto.ano))} · atualizado em ${esc(projeto.ultimaAtualizacao || "—")}</div>
      </div>
      <div class="row-end">
        ${badgeFromLista(listas.statusProjeto, projeto.statusProjeto)}
        <a class="btn btn-ghost" href="#/protocolo/${esc(projeto.id)}">Protocolo: Arquivamento e Backup</a>
        <button class="btn edit-only" data-act="editar">Editar</button>
        <button class="btn btn-ghost edit-only" data-act="excluir" title="Excluir projeto"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
      </div>
    </div>

    <div class="meta-grid">
      ${metaCell("Atividade atual", esc(projeto.atividadeAtual || "—"))}
      ${metaCell("ALFRED", esc(projeto.alfred || "—"))}
      ${metaCell("LTO", (projeto.lto || []).length
        ? `<div class="tags">${projeto.lto.map((l) => `<span class="tag">${esc(l)}</span>`).join("")}</div>`
        : "—")}
      ${metaCell(
        "Localizações",
        midias.length
          ? `${midias.length} mídia${midias.length > 1 ? "s" : ""} · ${[...midias]
              .sort((a, b) => compararNomes(a.nome, b.nome))
              .map((m) => esc(m.capacidade || "—")).join(" + ")} = ${esc(totalTexto)}`
          : `<span class="muted">nenhuma mídia</span>`
      )}
    </div>

    <!-- MÍDIAS -->
    <section class="section">
      <div class="section-head"><h2>Mídias <span class="section-hint">clique numa mídia pra ver a estrutura de pastas dela</span></h2>
        <button class="btn btn-ghost edit-only" data-act="nova-midia">+ Nova mídia</button></div>
      <div class="midia-grid" id="midias">
        ${midias.length ? midias.map((m) => midiaCard(m, listas, projeto.id)).join("")
          : `<div class="empty">Nenhuma mídia contém este projeto.</div>`}
      </div>
    </section>

    <!-- FITAS -->
    <section class="section">
      <div class="section-head"><h2>Fitas <span class="section-hint">fitas vinculadas a este projeto</span></h2></div>
      <div class="list-card">
        ${fitas.length ? fitas.map((f) => fitaRow(f, listas)).join("")
          : `<div class="empty">Nenhuma fita vinculada a este projeto.</div>`}
      </div>
    </section>

    <!-- HISTÓRICO -->
    <section class="section">
      <div class="section-head"><h2>Histórico</h2>
        <button class="btn btn-ghost edit-only" data-act="novo-historico">+ Novo registro</button></div>
      <div class="list-card">
        ${historico.length ? historico.map((h) => historicoRow(h)).join("")
          : `<div class="empty">Sem histórico.</div>`}
      </div>
    </section>

    <!-- PENDÊNCIAS -->
    <section class="section">
      <div class="section-head"><h2>Pendências</h2>
        <button class="btn btn-ghost edit-only" data-act="nova-demanda">+ Nova demanda</button></div>
      <div class="list-card">
        ${demandas.length ? demandas.map((d) => demandaRow(d, listas)).join("")
          : `<div class="empty">Sem pendências.</div>`}
      </div>
    </section>
  `;

  // navegação para detalhe de mídia (ignora cliques nos botões de ação)
  app.querySelector("#midias").addEventListener("click", (e) => {
    if (e.target.closest("[data-row-act]")) return;
    const row = e.target.closest("[data-midia]");
    if (row) location.hash = `#/midia/${row.dataset.midia}`;
  });

  // ações do projeto (cabeçalho) e de adicionar itens
  const acoes = {
    "editar": () => abrirNovoProjeto(projeto),
    "excluir": async () => {
      if (!confirm(`Excluir o projeto "${projeto.nome}"?\n\nIsto remove também a estrutura, o histórico e as pendências deste projeto, e tira o projeto das mídias. Não dá para desfazer.`)) return;
      await store.removeProjeto(projeto.id);
      location.hash = "#/";
    },
    "nova-midia": () => abrirNovaMidia(null, { projetoIdFixo: projeto.id }),
    "novo-historico": () => abrirNovoHistorico({ projetoIdFixo: projeto.id }),
    "nova-demanda": () => abrirNovaDemanda(projeto.id),
  };
  app.querySelectorAll("[data-act]").forEach((btn) =>
    btn.addEventListener("click", () => acoes[btn.dataset.act]?.(btn))
  );

  // editar/excluir itens das listas
  ligaItens(app, "h", historico,
    (rec) => abrirNovoHistorico({ projetoIdFixo: projeto.id }, rec),
    (rec) => [`Excluir este registro de histórico (${rec.periodo})?`, () => store.removeHistorico(rec.id)]);
  ligaItens(app, "d", demandas,
    (rec) => abrirNovaDemanda(projeto.id, rec),
    (rec) => [`Excluir a pendência "${rec.pendencia}"?`, () => store.removeDemanda(rec.id)]);
}

/* liga os botões ✎/🗑 de uma lista. tipo: "e" | "h" | "d" */
function ligaItens(app, tipo, registros, onEdit, onDel) {
  const porId = Object.fromEntries(registros.map((r) => [r.id, r]));
  app.querySelectorAll(`[data-edit="${tipo}"]`).forEach((b) =>
    b.addEventListener("click", () => onEdit(porId[b.dataset.id]))
  );
  app.querySelectorAll(`[data-del="${tipo}"]`).forEach((b) =>
    b.addEventListener("click", async () => {
      const [msg, acao] = onDel(porId[b.dataset.id]);
      if (!confirm(msg)) return;
      await acao();
      window.dispatchEvent(new CustomEvent("data-changed"));
    })
  );
}

function acoesRow(tipo, id) {
  return `<span class="lr-actions edit-only">
    <button class="icon-btn" data-row-act data-edit="${tipo}" data-id="${esc(id)}" title="Editar"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
    <button class="icon-btn danger" data-row-act data-del="${tipo}" data-id="${esc(id)}" title="Excluir"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
  </span>`;
}

// extrai o número de TB de um texto livre de capacidade (ex.: "8 TB", "8TB")
function parseTB(capacidade) {
  const m = String(capacidade || "").match(/([\d.,]+)/);
  return m ? parseFloat(m[1].replace(",", ".")) || 0 : 0;
}
function fmtTB(n) { return `${Number.isInteger(n) ? n : n.toFixed(1)} TB`; }

function metaCell(label, valueHtml, extraClass = "") {
  return `<div class="meta-cell${extraClass ? ` ${extraClass}` : ""}">
    <div class="meta-label">${label}</div>
    <div class="meta-value">${valueHtml}</div>
  </div>`;
}

function midiaCard(m, listas, projetoId) {
  const n = (m.projetosArmazenados || []).length;
  const resumo = (m.conteudoPorProjeto || {})[projetoId] || "";
  return `<div class="midia-card clickable" data-midia="${esc(m.id)}">
    <img class="midia-card-icon" src="${esc(iconeMidia(m.tipo, listas))}" alt="${esc(m.tipo)}" loading="lazy">
    <div class="midia-card-body">
      <div class="lr-title">${esc(m.nome)}</div>
      <div class="lr-sub">${esc(m.tipo)} · ${esc(m.capacidade)}</div>
      <div class="lr-sub">${resumo
        ? esc(resumo)
        : `<span class="muted">${n > 1 ? `Contém ${n} projetos` : "Projeto único"}</span>`}</div>
    </div>
    ${badgeFromLista(listas.statusMidia, m.statusMidia)}
  </div>`;
}

function historicoRow(h) {
  return `<div class="list-row">
    <div class="lr-main">
      <div class="lr-title">${esc(h.acao)} <span class="muted" style="font-weight:400">· ${esc(h.periodo)}</span></div>
      <div class="lr-sub">${esc(h.observacoes || "")}</div>
    </div>
    ${acoesRow("h", h.id)}
  </div>`;
}

function demandaRow(d, listas) {
  const feita = d.status === "Concluída";
  return `<div class="list-row${feita ? " list-row--done" : ""}">
    <div class="lr-main">
      <div class="lr-title">${feita ? `<span class="done-check" title="Concluída"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>` : ""}${esc(d.pendencia)}</div>
      <div class="lr-sub">${esc(d.responsavel || "—")}</div>
    </div>
    ${badgeFromLista(listas.prioridade, d.prioridade)}
    ${badgeFromLista(listas.statusDemanda, d.status)}
    ${acoesRow("d", d.id)}
  </div>`;
}

function fitaRow(f, listas) {
  return `<div class="list-row">
    <div class="lr-main">
      <div class="lr-title">📼 ${esc(f.codigo)} <span class="muted" style="font-weight:400">· ${esc(f.tipo)}</span></div>
      <div class="lr-sub">${esc(f.localFisico || "")}${f.observacoes ? ` · ${esc(f.observacoes)}` : ""}</div>
    </div>
    ${badgeFromLista(listas.statusFita || [], f.statusFita)}
  </div>`;
}
