/* Demandas / Pendências — tarefas de todos os projetos.
   Filtro por status, criar, editar, excluir e navegar para o projeto. */

import { store } from "../data/store.js";
import { esc, ordenarDemandas } from "../ui/dom.js";
import { badgeFromLista } from "../ui/badges.js";
import { abrirNovaDemanda } from "./cadastros.js";

export async function renderDemandasLista(app) {
  const [demandas, listas] = await Promise.all([store.listDemandas(), store.getListas()]);
  let busca = "";
  let filtro = "Todas";

  const abertas = demandas.filter((d) => d.status === "Aberta" || d.status === "Em andamento").length;

  app.innerHTML = `
    <div class="page-head">
      <div><h1 class="page-title">Demandas</h1>
        <div class="page-sub">${demandas.length} no total · ${abertas} em aberto</div></div>
      <div class="toolbar"><button class="btn btn-amber edit-only" data-act="nova">+ Cadastrar demanda</button></div>
    </div>
    <div class="toolbar" style="margin-bottom:14px">
      <input class="input" id="busca" type="search" placeholder="Buscar pendência ou projeto…" />
    </div>
    <div class="filter-row" id="filtros"></div>
    <div class="list-card" id="lista"></div>
  `;

  const valores = ["Todas", ...listas.statusDemanda.map((s) => s.valor)];
  const filtros = app.querySelector("#filtros");
  filtros.innerHTML = valores.map((v) =>
    `<button class="chip ${v === "Todas" ? "active" : ""}" data-f="${esc(v)}">${esc(v)}</button>`).join("");

  const lista = app.querySelector("#lista");
  const porId = Object.fromEntries(demandas.map((d) => [d.id, d]));

  function desenhar() {
    const t = busca.trim().toLowerCase();
    const arr = ordenarDemandas(demandas.filter((d) => {
      const okBusca = !t || (d.pendencia || "").toLowerCase().includes(t) || (d.projetoNome || "").toLowerCase().includes(t);
      const okFiltro = filtro === "Todas" || d.status === filtro;
      return okBusca && okFiltro;
    }), listas.prioridade);
    lista.innerHTML = (arr.length
      ? `<div class="dem-header"><div class="lr-main"></div><div class="dem-col">Prioridade</div><div class="dem-col">Status</div><div style="width:56px"></div></div>`
        + arr.map((d) => row(d, listas)).join("")
      : `<div class="empty">Nenhuma demanda encontrada.</div>`);
  }
  desenhar();

  app.querySelector("#busca").addEventListener("input", (e) => { busca = e.target.value; desenhar(); });
  app.querySelector('[data-act="nova"]').addEventListener("click", () => abrirNovaDemanda());
  filtros.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    filtro = chip.dataset.f;
    filtros.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
    desenhar();
  });

  lista.addEventListener("click", async (e) => {
    const ed = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-del]");
    const rowEl = e.target.closest(".list-row");
    if (ed) return abrirNovaDemanda(null, porId[ed.dataset.id]);
    if (del) {
      const d = porId[del.dataset.id];
      if (!confirm(`Excluir a pendência "${d.pendencia}"?`)) return;
      await store.removeDemanda(d.id);
      window.dispatchEvent(new CustomEvent("data-changed"));
      return;
    }
    if (rowEl) location.hash = `#/projeto/${rowEl.dataset.projeto}`;
  });
}

function row(d, listas) {
  const feita = d.status === "Concluída";
  return `<div class="list-row clickable${feita ? " list-row--done" : ""}" data-projeto="${esc(d.projetoId)}">
    <div class="lr-main">
      <div class="lr-title">${feita ? `<span class="done-check" title="Concluída"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>` : ""}${esc(d.pendencia)}</div>
      <div class="lr-sub"><strong>${esc(d.projetoNome)}</strong> · ${esc(d.responsavel || "—")}</div>
    </div>
    <div class="dem-col">${badgeFromLista(listas.prioridade, d.prioridade)}</div>
    <div class="dem-col">${badgeFromLista(listas.statusDemanda, d.status)}</div>
    <span class="lr-actions edit-only">
      <button class="icon-btn" data-edit data-id="${esc(d.id)}" title="Editar"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
      <button class="icon-btn danger" data-del data-id="${esc(d.id)}" title="Excluir"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
    </span>
  </div>`;
}
