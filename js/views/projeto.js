/* Detalhe do Projeto — tudo sobre um projeto numa tela só:
   dados mestre, Mídias, Estrutura (agrupada por mídia), Histórico, Pendências.
   Inclui editar/excluir do projeto e de cada item das listas. */

import { store } from "../data/store.js";
import { esc, formatAno } from "../ui/dom.js";
import { badgeFromLista } from "../ui/badges.js";
import { abrirNovoProjeto, abrirNovaMidia, abrirNovaEstrutura, abrirNovoHistorico, abrirNovaDemanda } from "./cadastros.js";

export async function renderProjeto(app, id) {
  const projeto = await store.getProjeto(id);
  if (!projeto) {
    app.innerHTML = `<a class="back-link" href="#/">← Voltar</a>
      <div class="empty">Projeto não encontrado.</div>`;
    return;
  }

  const [listas, estrutura, midias, historico, demandas, fitas] = await Promise.all([
    store.getListas(),
    store.estruturaDoProjeto(id),
    store.midiasDoProjeto(id),
    store.historicoDoProjeto(id),
    store.demandasDoProjeto(id),
    store.fitasDoProjeto(id),
  ]);

  const midiaMap = Object.fromEntries(midias.map((m) => [m.id, m]));
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
        `Localizações <span class="loc-total-inline">(${midias.length} · ${totalTexto})</span>`,
        midias.length
          ? `<div class="loc-list">${[...midias].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((m) => `
              <div class="loc-list-item">
                <a href="#/midia/${esc(m.id)}" class="loc-nome" title="${esc(m.nome)}">${esc(m.nome)}</a>
                <span class="loc-cap">${esc(m.capacidade || "—")}</span>
              </div>`).join("")}</div>`
          : `<span class="muted">nenhuma mídia</span>`,
        "meta-cell--loc"
      )}
    </div>

    <!-- MÍDIAS -->
    <section class="section">
      <div class="section-head"><h2>Mídias <span class="section-hint">mídias que contêm este projeto</span></h2>
        <button class="btn btn-ghost edit-only" data-act="nova-midia">+ Nova mídia</button></div>
      <div class="list-card" id="midias">
        ${midias.length ? midias.map((m) => midiaRow(m, listas, projeto.id)).join("")
          : `<div class="empty">Nenhuma mídia contém este projeto.</div>`}
      </div>
    </section>

    <!-- ESTRUTURA (agrupada por mídia) -->
    <section class="section">
      <div class="section-head"><h2>Estrutura de pastas <span class="section-hint">pastas de cada mídia deste projeto</span></h2>
        <button class="btn btn-ghost edit-only" data-act="nova-pasta">+ Nova pasta</button></div>
      <div id="estrutura-grupos">
        ${estruturaAgrupada(estrutura, midiaMap, listas)}
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
    "nova-pasta": () => abrirNovaEstrutura({ projetoIdFixo: projeto.id }),
    "nova-pasta-grupo": (btn) => abrirNovaEstrutura({ projetoIdFixo: projeto.id, midiaIdFixo: btn.dataset.midia }),
    "novo-historico": () => abrirNovoHistorico({ projetoIdFixo: projeto.id }),
    "nova-demanda": () => abrirNovaDemanda(projeto.id),
  };
  app.querySelectorAll("[data-act]").forEach((btn) =>
    btn.addEventListener("click", () => acoes[btn.dataset.act]?.(btn))
  );

  // editar/excluir itens das listas
  ligaItens(app, "e", estrutura,
    (rec) => abrirNovaEstrutura({ projetoIdFixo: projeto.id }, rec),
    (rec) => [`Excluir a pasta "${rec.caminho}"?`, () => store.removeEstrutura(rec.id)]);
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

/* Estrutura agrupada por mídia */
function estruturaAgrupada(estrutura, midiaMap, listas) {
  if (!estrutura.length) {
    return `<div class="empty">Nenhuma pasta registrada. Cadastre pela mídia ou clique em "+ Nova pasta".</div>`;
  }

  const grupos = new Map();
  for (const e of estrutura) {
    const key = e.midiaId || "";
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key).push(e);
  }

  return [...grupos.entries()].map(([midiaId, pastas]) => {
    const midia = midiaMap[midiaId];
    const label = midia ? midia.nome : (midiaId ? "—" : "Sem mídia");
    const midiaRef = midia
      ? `<a href="#/midia/${esc(midiaId)}" class="est-grupo-link">${esc(label)}</a>`
      : `<span class="muted">${esc(label)}</span>`;
    const n = pastas.length;
    return `<div class="est-grupo">
      <div class="est-grupo-head">
        ${midiaRef}
        <span class="est-grupo-count">${n} ${n === 1 ? "pasta" : "pastas"}</span>
        ${midia ? `<button class="btn btn-ghost est-grupo-add edit-only" data-act="nova-pasta-grupo" data-midia="${esc(midiaId)}">+ pasta</button>` : ""}
      </div>
      <div class="list-card">
        ${pastas.map((p) => estruturaRow(p, listas)).join("")}
      </div>
    </div>`;
  }).join("");
}

function estruturaRow(e, listas) {
  return `<div class="list-row">
    <div class="lr-main">
      <div class="lr-title">${esc(e.caminho)} <span class="muted" style="font-weight:400">· ${esc(e.tipoMaterial)}</span></div>
      ${e.resumo ? `<div class="lr-sub">${esc(e.resumo)}</div>` : ""}
    </div>
    ${e.arquivadoLto ? `<span class="tag">${esc(e.arquivadoLto)}</span>` : ""}
    ${badgeFromLista(listas.statusPasta, e.statusPasta)}
    ${acoesRow("e", e.id)}
  </div>`;
}

function midiaRow(m, listas, projetoId) {
  const n = (m.projetosArmazenados || []).length;
  const resumo = (m.conteudoPorProjeto || {})[projetoId] || "";
  return `<div class="list-row clickable" data-midia="${esc(m.id)}">
    <div class="lr-main">
      <div class="lr-title">${esc(m.nome)} <span class="muted" style="font-weight:400">· ${esc(m.tipo)} · ${esc(m.capacidade)}</span></div>
      <div class="lr-sub">${resumo
        ? esc(resumo)
        : `<span class="muted">${n > 1 ? `Contém ${n} projetos` : "Projeto único"}</span>`}</div>
    </div>
    ${badgeFromLista(listas.statusMidia, m.statusMidia)}
    <span class="muted">›</span>
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
