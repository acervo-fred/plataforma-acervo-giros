/* Mídias — listagem geral do inventário (entidade independente).
   Busca, criar, editar, excluir e navegar para o detalhe. */

import { store } from "../data/store.js";
import { esc } from "../ui/dom.js";
import { badgeFromLista } from "../ui/badges.js";
import { abrirNovaMidia } from "./cadastros.js";

export async function renderMidiasLista(app) {
  const [midias, listas, projetos] = await Promise.all([store.listMidias(), store.getListas(), store.listProjetos()]);
  const nomePorId = Object.fromEntries(projetos.map((p) => [p.id, p.nome]));
  let busca = "";
  const mistura = midias.filter((m) => (m.projetosArmazenados || []).length > 1).length;

  app.innerHTML = `
    <div class="page-head">
      <div><h1 class="page-title">Mídias</h1>
        <div class="page-sub">${midias.length} mídias · ${mistura} com mistura</div></div>
      <div class="toolbar"><button class="btn btn-primary edit-only" data-act="nova-midia">+ Nova mídia</button></div>
    </div>
    <div class="toolbar" style="margin-bottom:16px">
      <input class="input" id="busca" type="search" placeholder="Buscar por nome ou tipo…" />
    </div>
    <div class="list-card" id="lista"></div>
  `;

  const lista = app.querySelector("#lista");
  const porId = Object.fromEntries(midias.map((m) => [m.id, m]));

  function desenhar() {
    const t = busca.trim().toLowerCase();
    const arr = midias
      .filter((m) => !t || m.nome.toLowerCase().includes(t) || (m.tipo || "").toLowerCase().includes(t))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    lista.innerHTML = arr.length ? arr.map((m) => row(m, listas, nomePorId)).join("")
      : `<div class="empty">Nenhuma mídia encontrada.</div>`;
  }
  desenhar();

  app.querySelector("#busca").addEventListener("input", (e) => { busca = e.target.value; desenhar(); });
  app.querySelector('[data-act="nova-midia"]').addEventListener("click", () => abrirNovaMidia());

  lista.addEventListener("click", async (e) => {
    const ed = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-del]");
    const rowEl = e.target.closest(".list-row");
    if (ed) return abrirNovaMidia(porId[ed.dataset.id]);
    if (del) {
      const m = porId[del.dataset.id];
      if (!confirm(`Excluir a mídia "${m.nome}"?\n\nOs projetos não são apagados — só o registro desta mídia.`)) return;
      await store.removeMidia(m.id);
      window.dispatchEvent(new CustomEvent("data-changed"));
      return;
    }
    if (rowEl) location.hash = `#/midia/${rowEl.dataset.id}`;
  });
}

function row(m, listas, nomePorId) {
  const nomes = (m.projetosArmazenados || []).map((pid) => nomePorId[pid] || "?").join(", ");
  const sub = nomes || "Sem projetos vinculados";
  return `<div class="list-row clickable" data-id="${esc(m.id)}">
    <div class="lr-main">
      <div class="lr-title">${esc(m.nome)} <span class="muted" style="font-weight:400">· ${esc(m.tipo)} · ${esc(m.capacidade || "—")}${m.local ? ` · ${esc(m.local)}` : ""}</span></div>
      <div class="lr-sub">${esc(sub)}</div>
    </div>
    ${badgeFromLista(listas.statusMidia, m.statusMidia)}
    <span class="lr-actions edit-only">
      <button class="icon-btn" data-edit data-id="${esc(m.id)}" title="Editar"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
      <button class="icon-btn danger" data-del data-id="${esc(m.id)}" title="Excluir"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
    </span>
    <span class="muted">›</span>
  </div>`;
}
