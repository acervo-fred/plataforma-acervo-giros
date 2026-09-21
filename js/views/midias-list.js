/* Mídias — inventário geral (entidade independente), em tabela.
   Busca, filtros por tipo/local/status, coluna de projetos armazenados
   (chips clicáveis, join client-side), criar, editar, excluir e
   navegar para o detalhe. */

import { store } from "../data/store.js";
import { esc, compararNomes } from "../ui/dom.js";
import { badgeFromLista, chipsProjetos } from "../ui/badges.js";
import { iconeMidia } from "../ui/icons.js";
import { parseTB, fmtTB, fmtUso } from "../ui/formato.js";
import { abrirNovaMidia } from "./cadastros.js";

const TODOS = "__todos__";

export async function renderMidiasLista(app) {
  const [midias, listas, projetos] = await Promise.all([
    store.listMidias(), store.getListas(), store.listProjetos(),
  ]);
  const nomePorId = Object.fromEntries(projetos.map((p) => [p.id, p.nome]));

  const filtros = { busca: "", tipo: TODOS, local: TODOS, status: TODOS };

  const valores = (lista) => (lista || []).map((it) => (typeof it === "string" ? it : it.valor));
  // "Onde está" aceita vazio no cadastro — a opção "Sem local" cobre esses casos
  const locaisUsados = [...new Set(midias.map((m) => m.local).filter(Boolean))];
  const locais = [...new Set([...valores(listas.locais), ...locaisUsados])];

  app.innerHTML = `
    <div class="page-head">
      <div><h1 class="page-title">Mídias</h1>
        <div class="page-sub" id="resumo"></div></div>
      <div class="toolbar"><button class="btn btn-primary edit-only" data-act="nova-midia">+ Nova mídia</button></div>
    </div>

    <div class="filtros-bar">
      <input class="input" id="busca" type="search" placeholder="Buscar por nome ou conteúdo…" />
      ${selectFiltro("tipo", "Tipo", valores(listas.tipoMidia))}
      ${selectFiltro("local", "Local", locais, "Sem local")}
      ${selectFiltro("status", "Status", valores(listas.statusMidia))}
      <button class="btn btn-ghost btn-sm" id="limpar" hidden>Limpar filtros</button>
    </div>

    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th class="col-nome">Mídia</th>
            <th class="col-local">Local</th>
            <th class="col-tamanho">Tamanho</th>
            <th class="col-proj">Projetos armazenados</th>
            <th class="col-status">Status</th>
            <th class="col-acoes"></th>
          </tr>
        </thead>
        <tbody id="corpo"></tbody>
      </table>
      <div id="vazio"></div>
    </div>
  `;

  const corpo = app.querySelector("#corpo");
  const vazio = app.querySelector("#vazio");
  const resumo = app.querySelector("#resumo");
  const btnLimpar = app.querySelector("#limpar");
  const porId = Object.fromEntries(midias.map((m) => [m.id, m]));

  function combina(m) {
    const t = filtros.busca.trim().toLowerCase();
    const okBusca = !t
      || m.nome.toLowerCase().includes(t)
      || (m.tipo || "").toLowerCase().includes(t)
      || (m.conteudo || "").toLowerCase().includes(t)
      || (m.projetosArmazenados || []).some((pid) => (nomePorId[pid] || "").toLowerCase().includes(t));
    const okTipo = filtros.tipo === TODOS || m.tipo === filtros.tipo;
    const okLocal = filtros.local === TODOS || (m.local || "") === (filtros.local === "" ? "" : filtros.local);
    const okStatus = filtros.status === TODOS || m.statusMidia === filtros.status;
    return okBusca && okTipo && okLocal && okStatus;
  }

  function desenhar() {
    const arr = midias.filter(combina).sort((a, b) => compararNomes(a.nome, b.nome));
    corpo.innerHTML = arr.map((m) => row(m, listas, nomePorId)).join("");
    vazio.innerHTML = arr.length ? "" : `<div class="empty">Nenhuma mídia encontrada.</div>`;

    const totalTB = arr.reduce((s, m) => s + parseTB(m.capacidade), 0);
    const mistura = arr.filter((m) => (m.projetosArmazenados || []).length > 1).length;
    const filtrando = arr.length !== midias.length;
    resumo.textContent = `${arr.length}${filtrando ? ` de ${midias.length}` : ""} mídias · ${fmtTB(totalTB)} · ${mistura} com mistura`;
    btnLimpar.hidden = !filtrando;
  }
  desenhar();

  // ---- eventos ----
  app.querySelector("#busca").addEventListener("input", (e) => { filtros.busca = e.target.value; desenhar(); });
  app.querySelectorAll("[data-filtro]").forEach((sel) =>
    sel.addEventListener("change", () => { filtros[sel.dataset.filtro] = sel.value; desenhar(); })
  );
  btnLimpar.addEventListener("click", () => {
    Object.assign(filtros, { busca: "", tipo: TODOS, local: TODOS, status: TODOS });
    app.querySelector("#busca").value = "";
    app.querySelectorAll("[data-filtro]").forEach((sel) => { sel.value = TODOS; });
    desenhar();
  });
  app.querySelector('[data-act="nova-midia"]').addEventListener("click", () => abrirNovaMidia());

  corpo.addEventListener("click", async (e) => {
    // chips de projeto levam pro projeto — não abrem a mídia
    if (e.target.closest("a.proj-chip")) return;
    const ed = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-del]");
    const tr = e.target.closest("tr[data-id]");
    if (ed) return abrirNovaMidia(porId[ed.dataset.id]);
    if (del) {
      const m = porId[del.dataset.id];
      if (!confirm(`Excluir a mídia "${m.nome}"?\n\nOs projetos não são apagados — só o registro desta mídia.`)) return;
      await store.removeMidia(m.id);
      window.dispatchEvent(new CustomEvent("data-changed"));
      return;
    }
    if (tr) location.hash = `#/midia/${tr.dataset.id}`;
  });
}

function selectFiltro(nome, rotulo, valores, rotuloVazio = null) {
  const opts = [
    `<option value="${TODOS}">${esc(rotulo)}: todos</option>`,
    ...(rotuloVazio ? [`<option value="">${esc(rotuloVazio)}</option>`] : []),
    ...valores.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`),
  ].join("");
  return `<select class="input select" data-filtro="${nome}" aria-label="${esc(rotulo)}">${opts}</select>`;
}

function row(m, listas, nomePorId) {
  const ids = m.projetosArmazenados || [];
  const segundaLinha = [m.tipo, m.conteudo].filter(Boolean).join(" · ");
  return `<tr data-id="${esc(m.id)}">
    <td class="col-nome">
      <div class="dt-midia">
        <img class="dt-ic" src="${esc(iconeMidia(m.tipo, listas))}" alt="" loading="lazy">
        <div class="dt-midia-txt">
          <div class="dt-nome" title="${esc(m.nome)}">${esc(m.nome)}</div>
          ${segundaLinha ? `<div class="dt-sub" title="${esc(segundaLinha)}">${esc(segundaLinha)}</div>` : ""}
        </div>
      </div>
    </td>
    <td class="col-local">${m.local ? esc(m.local) : `<span class="muted">—</span>`}</td>
    <td class="col-tamanho">${esc(fmtUso(m))}</td>
    <td class="col-proj">${chipsProjetos(ids, nomePorId, { max: 2 })}</td>
    <td class="col-status">${badgeFromLista(listas.statusMidia, m.statusMidia)}</td>
    <td class="col-acoes">
      <span class="lr-actions edit-only">
        <button class="icon-btn" data-edit data-id="${esc(m.id)}" title="Editar"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
        <button class="icon-btn danger" data-del data-id="${esc(m.id)}" title="Excluir"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
      </span>
    </td>
  </tr>`;
}
