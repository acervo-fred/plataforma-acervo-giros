/* Projetos (home) — grade de cards (galeria), atalhos rápidos de
   cadastro, busca e filtro por status. A atividade recente agora
   vive no drawer da sidebar (ver app.js). */

import { store } from "../data/store.js";
import { esc, formatAno } from "../ui/dom.js";
import { badgeFromLista, corDoValor } from "../ui/badges.js";
import { abrirNovoProjeto, abrirNovaDemanda } from "./cadastros.js";

// mapa de cor da paleta -> variável CSS do foreground (para a faixa do card)
const CORVAR = {
  gray: "--c-gray-fg", blue: "--c-blue-fg", amber: "--c-amber-fg",
  green: "--c-green-fg", violet: "--c-violet-fg", rose: "--c-rose-fg",
  teal: "--c-teal-fg", slate: "--c-slate-fg",
};

export async function renderHome(app) {
  const [projetos, listas] = await Promise.all([
    store.listProjetos(),
    store.getListas(),
  ]);

  let busca = "";
  let filtroStatus = "Todos";

  app.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Projetos</h1>
        <div class="page-sub">${projetos.length} projetos no acervo</div>
      </div>
      <div class="toolbar">
        <button class="btn btn-primary" data-act="novo-projeto">+ Novo projeto</button>
        <button class="btn btn-amber" data-act="cadastrar-demanda">+ Cadastrar demanda</button>
      </div>
    </div>

    <div class="toolbar" style="margin-bottom:16px">
      <input class="input" id="busca" type="search" placeholder="Buscar projeto…" />
    </div>
    <div class="filter-row" id="filtros"></div>

    <div class="card-grid" id="grid"></div>
  `;

  // ---- filtros (chips) ----
  const valoresStatus = ["Todos", ...listas.statusProjeto.map((s) => s.valor)];
  const filtros = app.querySelector("#filtros");
  filtros.innerHTML = valoresStatus
    .map((v) => `<button class="chip ${v === "Todos" ? "active" : ""}" data-status="${esc(v)}">${esc(v)}</button>`)
    .join("");

  const grid = app.querySelector("#grid");

  function desenhar() {
    const termo = busca.trim().toLowerCase();
    const lista = projetos
      .filter((p) => {
        const okBusca = !termo || p.nome.toLowerCase().includes(termo) || String(p.ano).includes(termo);
        const okStatus = filtroStatus === "Todos" || p.statusProjeto === filtroStatus;
        return okBusca && okStatus;
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    grid.innerHTML = lista.length
      ? lista.map((p) => projectCard(p, listas)).join("")
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

  // atalhos de cadastro
  app.querySelector(".page-head .toolbar").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const acoes = {
      "novo-projeto": () => abrirNovoProjeto(),
      "cadastrar-demanda": () => abrirNovaDemanda(),
    };
    acoes[btn.dataset.act]?.();
  });
}

function projectCard(p, listas) {
  const cor = corDoValor(listas.statusProjeto, p.statusProjeto);
  const corvar = CORVAR[cor] || "--border-strong";
  const nLocais = (p.localizacoes || []).length;
  return `
    <article class="project-card" data-projeto="${esc(p.id)}" style="--card-accent: var(${corvar})">
      <div class="pc-year">${esc(formatAno(p.ano))}</div>
      <h3 class="pc-name">${esc(p.nome)}</h3>
      <div class="pc-foot">
        ${badgeFromLista(listas.statusProjeto, p.statusProjeto)}
        <span class="muted" style="font-size:12.5px">${nLocais === 1 ? "1 local" : `${nLocais} locais`}</span>
      </div>
    </article>`;
}
