/* Projetos (home) — galeria de cards com capa 16:9, badge de status
   sobre a capa e duas métricas rápidas (mídias vinculadas e tamanho
   total). Busca + filtro por status em chips. A atividade recente
   vive no drawer da sidebar (ver app.js). */

import { store } from "../data/store.js";
import { esc, formatAno, compararNomes } from "../ui/dom.js";
import { badgeFromLista, corDoValor } from "../ui/badges.js";
import { fmtTB, somaUsado } from "../ui/formato.js";
import { abrirNovoProjeto } from "./cadastros.js";

// mapa de cor da paleta -> variáveis CSS (fundo/traço do placeholder de capa)
const CORVAR = {
  gray: "--c-gray", blue: "--c-blue", amber: "--c-amber",
  green: "--c-green", violet: "--c-violet", rose: "--c-rose",
  teal: "--c-teal", slate: "--c-slate",
};

export async function renderHome(app) {
  const [projetos, listas, midias] = await Promise.all([
    store.listProjetos(),
    store.getListas(),
    store.listMidias(),
  ]);

  // join client-side: mídias -> projetos (não há relação nativa no Firestore)
  const porProjeto = new Map();
  for (const m of midias) {
    for (const pid of m.projetosArmazenados || []) {
      if (!porProjeto.has(pid)) porProjeto.set(pid, []);
      porProjeto.get(pid).push(m);
    }
  }
  const metricas = (id) => {
    const lista = porProjeto.get(id) || [];
    return { nMidias: lista.length, tamanho: fmtTB(somaUsado(lista)) };
  };

  let busca = "";
  let filtroStatus = "Todos";

  app.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Projetos</h1>
        <div class="page-sub">${projetos.length} projetos no acervo</div>
      </div>
      <div class="toolbar">
        <input class="input" id="busca" type="search" placeholder="Buscar projeto…" />
        <button class="btn btn-primary edit-only" data-act="novo-projeto">+ Novo projeto</button>
      </div>
    </div>

    <div class="filter-row" id="filtros"></div>

    <div class="proj-grid" id="grid"></div>
  `;

  // ---- filtros (chips), com contagem por status ----
  const contaStatus = (v) => projetos.filter((p) => p.statusProjeto === v).length;
  const filtros = app.querySelector("#filtros");
  filtros.innerHTML = [
    `<button class="chip active" data-status="Todos">Todos <span class="chip-n">${projetos.length}</span></button>`,
    ...listas.statusProjeto.map((s) => {
      const v = typeof s === "string" ? s : s.valor;
      return `<button class="chip" data-status="${esc(v)}">${esc(v)} <span class="chip-n">${contaStatus(v)}</span></button>`;
    }),
  ].join("");

  const grid = app.querySelector("#grid");

  function desenhar() {
    const termo = busca.trim().toLowerCase();
    const lista = projetos
      .filter((p) => {
        const okBusca = !termo || p.nome.toLowerCase().includes(termo) || String(p.ano).includes(termo);
        const okStatus = filtroStatus === "Todos" || p.statusProjeto === filtroStatus;
        return okBusca && okStatus;
      })
      .sort((a, b) => compararNomes(a.nome, b.nome));
    grid.innerHTML = lista.length
      ? lista.map((p) => projectCard(p, listas, metricas(p.id))).join("")
      : `<div class="empty">Nenhum projeto encontrado.</div>`;
  }
  desenhar();

  // ---- eventos ----
  app.querySelector("#busca").addEventListener("input", (e) => {
    busca = e.target.value;
    desenhar();
  });

  filtros.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    filtroStatus = chip.dataset.status;
    filtros.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
    desenhar();
  });

  grid.addEventListener("click", (e) => {
    const card = e.target.closest("[data-projeto]");
    if (card) location.hash = `#/projeto/${card.dataset.projeto}`;
  });

  app.querySelector('[data-act="novo-projeto"]').addEventListener("click", () => abrirNovoProjeto());
}

function projectCard(p, listas, { nMidias, tamanho }) {
  const cor = corDoValor(listas.statusProjeto, p.statusProjeto);
  const base = CORVAR[cor] || "--c-gray";
  const inicial = (p.nome || "?").trim().charAt(0).toUpperCase();
  const capa = p.capa
    ? `<img class="pcard-img" src="${esc(p.capa)}" alt="" loading="lazy"
         onerror="this.remove()" />`
    : "";
  return `
    <article class="proj-card" data-projeto="${esc(p.id)}"
      style="--capa-bg: var(${base}-bg); --capa-fg: var(${base}-fg)">
      <div class="pcard-capa">
        <span class="pcard-inicial" aria-hidden="true">${esc(inicial)}</span>
        ${capa}
        <span class="pcard-badge">${badgeFromLista(listas.statusProjeto, p.statusProjeto)}</span>
      </div>
      <div class="pcard-body">
        <h3 class="pcard-nome" title="${esc(p.nome)}">${esc(p.nome)}</h3>
        <div class="pcard-ano">${esc(formatAno(p.ano))}</div>
        <div class="pcard-stats">
          <span class="pcard-stat"><strong>${nMidias}</strong> ${nMidias === 1 ? "mídia" : "mídias"}</span>
          <span class="pcard-sep"></span>
          <span class="pcard-stat"><strong>${esc(tamanho)}</strong></span>
        </div>
      </div>
    </article>`;
}
