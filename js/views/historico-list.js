/* Histórico — diário técnico de todos os projetos, em ordem
   cronológica (recente → antigo). Criar, editar, excluir e
   navegar para o projeto. */

import { store } from "../data/store.js";
import { esc } from "../ui/dom.js";
import { openModal } from "../ui/modal.js";
import { abrirNovoHistorico } from "./cadastros.js";

export async function renderHistoricoLista(app) {
  const historico = await store.listHistorico();
  let busca = "";

  app.innerHTML = `
    <div class="page-head">
      <div><h1 class="page-title">Histórico</h1>
        <div class="page-sub">${historico.length} registros (todos os projetos)</div></div>
      <div class="toolbar"><button class="btn btn-primary" data-act="novo">+ Novo registro</button></div>
    </div>
    <div class="toolbar" style="margin-bottom:16px">
      <input class="input" id="busca" type="search" placeholder="Buscar por projeto, ação ou observação…" />
    </div>
    <div class="list-card" id="lista"></div>
  `;

  const lista = app.querySelector("#lista");
  const porId = Object.fromEntries(historico.map((h) => [h.id, h]));

  function desenhar() {
    const t = busca.trim().toLowerCase();
    const arr = historico.filter((h) =>
      !t || (h.projetoNome || "").toLowerCase().includes(t)
        || (h.acao || "").toLowerCase().includes(t)
        || (h.observacoes || "").toLowerCase().includes(t));
    lista.innerHTML = arr.length ? arr.map(row).join("")
      : `<div class="empty">Nenhum registro encontrado.</div>`;
  }
  desenhar();

  app.querySelector("#busca").addEventListener("input", (e) => { busca = e.target.value; desenhar(); });
  app.querySelector('[data-act="novo"]').addEventListener("click", () => abrirNovoHistorico());

  lista.addEventListener("click", async (e) => {
    const ed = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-del]");
    const rowEl = e.target.closest(".list-row");
    if (ed) return abrirNovoHistorico(null, porId[ed.dataset.id]);
    if (del) {
      const h = porId[del.dataset.id];
      if (!confirm(`Excluir este registro (${h.periodo} · ${h.acao})?`)) return;
      await store.removeHistorico(h.id);
      window.dispatchEvent(new CustomEvent("data-changed"));
      return;
    }
    if (rowEl && rowEl.dataset.id) {
      const h = porId[rowEl.dataset.id];
      if (h) abrirLeituraHistorico(h);
    }
  });
}

function row(h) {
  return `<div class="list-row clickable" data-id="${esc(h.id)}" data-projeto="${esc(h.projetoId)}">
    <div class="lr-main">
      <div class="lr-title">${esc(h.acao)} <span class="muted" style="font-weight:400">· ${esc(h.periodo)}</span></div>
      <div class="lr-sub"><strong>${esc(h.projetoNome)}</strong>${h.observacoes ? " · " + esc(h.observacoes) : ""}</div>
    </div>
    <span class="lr-actions">
      <button class="icon-btn" data-edit data-id="${esc(h.id)}" title="Editar"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
      <button class="icon-btn danger" data-del data-id="${esc(h.id)}" title="Excluir"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
    </span>
  </div>`;
}

function abrirLeituraHistorico(h) {
  openModal({
    title: h.acao,
    subtitle: h.projetoNome || "",
    submitLabel: "Editar",
    bodyHtml: `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
        <div><div class="meta-label">Período</div><div style="font-size:14.5px;font-weight:550">${esc(h.periodo)}</div></div>
        <div><div class="meta-label">Tipo</div><div style="font-size:14.5px;font-weight:550">${esc(h.periodoTipo || "—")}</div></div>
      </div>
      ${h.observacoes ? `<div><div class="meta-label">Observações</div><div style="font-size:14.5px;line-height:1.6;margin-top:4px">${esc(h.observacoes)}</div></div>` : `<div class="muted" style="font-size:14px">Sem observações.</div>`}
      ${h.projetoId ? `<div style="margin-top:16px"><a href="#/projeto/${esc(h.projetoId)}" style="font-size:13px;color:var(--accent)">Ir para o projeto →</a></div>` : ""}
    `,
    onSubmit: async () => {
      abrirNovoHistorico(null, h);
    },
  });
}
