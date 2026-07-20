import { store } from "../data/store.js";
import { esc } from "../ui/dom.js";
import { badgeFromLista } from "../ui/badges.js";
import { abrirNovaFita, abrirLoteFitas } from "./cadastros.js";

export async function renderFitasLista(app) {
  const [fitas, listas, projetos] = await Promise.all([
    store.listFitas(), store.getListas(), store.listProjetos(),
  ]);
  const nomePorId = Object.fromEntries(projetos.map((p) => [p.id, p.nome]));
  let busca = "";
  let filtroTipo = "";
  let filtroStatus = "";

  const tipos = listas.tipoFita || ["Betacam 30", "Betacam 60", "Mini DV"];
  const statuses = listas.statusFita || [];

  const contagemPorTipo = tipos.map((t) => ({
    tipo: t,
    qtd: fitas.filter((f) => f.tipo === t).length,
  }));

  function metaCell(label, value) {
    return `<div class="meta-cell"><div class="meta-label">${label}</div><div class="meta-value">${value}</div></div>`;
  }

  app.innerHTML = `
    <div class="page-head">
      <div><h1 class="page-title">Fitas</h1>
        <div class="page-sub">Inventário de fitas físicas</div></div>
      <div class="toolbar" style="gap:8px">
        <button class="btn btn-primary" data-act="nova-fita">+ Nova fita</button>
        <button class="btn" data-act="lote">+ Cadastro em lote</button>
      </div>
    </div>
    <div class="meta-grid">
      ${metaCell("Total", `<span style="font-size:22px;font-weight:700">${fitas.length}</span>`)}
      ${contagemPorTipo.map((c) => metaCell(esc(c.tipo), `<span style="font-size:22px;font-weight:700">${c.qtd}</span>`)).join("")}
    </div>
    <div class="toolbar" style="margin-bottom:16px; gap:10px; flex-wrap:wrap">
      <input class="input" id="busca" type="search" placeholder="Buscar por código, projeto ou local…" style="flex:1;min-width:180px" />
      <select class="input" id="filtro-tipo" style="width:auto">
        <option value="">Todos os tipos</option>
        ${tipos.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}
      </select>
      <select class="input" id="filtro-status" style="width:auto">
        <option value="">Todos os status</option>
        ${statuses.map((s) => {
          const v = typeof s === "string" ? s : s.valor;
          return `<option value="${esc(v)}">${esc(v)}</option>`;
        }).join("")}
      </select>
    </div>
    <div class="list-card" id="lista"></div>
  `;

  const lista = app.querySelector("#lista");
  const porId = Object.fromEntries(fitas.map((f) => [f.id, f]));

  function filtradas() {
    const t = busca.trim().toLowerCase();
    return fitas.filter((f) => {
      if (filtroTipo && f.tipo !== filtroTipo) return false;
      if (filtroStatus && f.statusFita !== filtroStatus) return false;
      if (t && !(
        (f.codigo || "").toLowerCase().includes(t) ||
        nomeProjetoDaFita(f, nomePorId).toLowerCase().includes(t) ||
        (f.localFisico || "").toLowerCase().includes(t) ||
        (f.observacoes || "").toLowerCase().includes(t)
      )) return false;
      return true;
    });
  }

  function desenhar() {
    const arr = filtradas();
    lista.innerHTML = arr.length
      ? arr.map((f) => row(f, listas, nomePorId)).join("")
      : `<div class="empty">Nenhuma fita encontrada.</div>`;
  }
  desenhar();

  app.querySelector("#busca").addEventListener("input", (e) => { busca = e.target.value; desenhar(); });
  app.querySelector("#filtro-tipo").addEventListener("change", (e) => { filtroTipo = e.target.value; desenhar(); });
  app.querySelector("#filtro-status").addEventListener("change", (e) => { filtroStatus = e.target.value; desenhar(); });
  app.querySelector('[data-act="nova-fita"]').addEventListener("click", () => abrirNovaFita());
  app.querySelector('[data-act="lote"]').addEventListener("click", () => abrirLoteFitas());

  lista.addEventListener("click", async (e) => {
    const ed = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-del]");
    if (ed) return abrirNovaFita(porId[ed.dataset.id]);
    if (del) {
      const f = porId[del.dataset.id];
      if (!confirm(`Excluir a fita "${f.codigo}"?`)) return;
      await store.removeFita(f.id);
      window.dispatchEvent(new CustomEvent("data-changed"));
    }
  });
}

// Nome do projeto de uma fita: sempre resolvido pelo projetoId (fonte de verdade).
// projetoNome é só um cache legado — usado apenas se o projeto vinculado sumiu.
function nomeProjetoDaFita(f, nomePorId) {
  if (f.projetoId && nomePorId[f.projetoId]) return nomePorId[f.projetoId];
  return f.projetoNome || "";
}

function row(f, listas, nomePorId) {
  const projeto = nomeProjetoDaFita(f, nomePorId);
  const parts = [f.tipo, f.localFisico, projeto].filter(Boolean).join(" · ");
  return `<div class="list-row fita-row" data-id="${esc(f.id)}">
    <div class="lr-main">
      <span class="fita-codigo">${esc(f.codigo)}</span>
      <span class="fita-meta muted">${esc(parts)}</span>
    </div>
    ${badgeFromLista(listas.statusFita, f.statusFita)}
    <span class="lr-actions">
      <button class="icon-btn" data-edit data-id="${esc(f.id)}" title="Editar"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
      <button class="icon-btn danger" data-del data-id="${esc(f.id)}" title="Excluir"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
    </span>
  </div>`;
}
