/* Projetos do Acervo — lista de prioridade de digitalização, herdada
   do "Avaliação do Acervo". Mesma mecânica de bolinhas 1–10 e
   observação por linha; simplificado (sem busca, CSV ou "limpar
   notas"), com ordenação por prioridade ou por nome. */

import { store } from "../data/store.js";
import { esc } from "../ui/dom.js";
import { organizacaoProjetosTitulos as TITULOS } from "../data/mock.js";

function corFaixa(v, s) { return v > s ? "" : s <= 3 ? "low" : s <= 6 ? "mid" : "high"; }

export async function renderProjetosPrioridade(cont) {
  const prioridades = await store.getPrioridades();
  let linhas = TITULOS.map((titulo) => ({
    titulo,
    prioridade: prioridades[titulo]?.prioridade || 0,
    observacao: prioridades[titulo]?.observacao || "",
  }));

  let ordenacao = "nome";
  let filtro = "todos";

  cont.innerHTML = `
    <div class="toolbar" style="margin-bottom:10px; justify-content:space-between; flex-wrap:wrap; gap:10px">
      <div class="filter-row" id="org-proj-filtros" style="margin-bottom:0">
        <button class="chip active" data-f="todos">Todos</button>
        <button class="chip" data-f="avaliados">Avaliados</button>
      </div>
      <div class="filter-row" id="org-proj-ordem" style="margin-bottom:0">
        <span class="muted" style="font-size:12.5px;align-self:center">Ordenar por:</span>
        <button class="chip active" data-o="nome">Nome</button>
        <button class="chip" data-o="prioridade">Prioridade</button>
      </div>
    </div>
    <div class="page-sub" id="org-proj-stats" style="margin-bottom:14px"></div>
    <div class="table-wrap">
      <table class="org-proj-table">
        <thead><tr>
          <th class="num-h">#</th>
          <th>Título</th>
          <th class="rating-h">Prioridade (1 – 10)</th>
          <th>Observações</th>
        </tr></thead>
        <tbody id="org-proj-body"></tbody>
      </table>
    </div>
  `;

  const stats = cont.querySelector("#org-proj-stats");
  const body = cont.querySelector("#org-proj-body");

  function linhasVisiveis() {
    const base = filtro === "avaliados" ? linhas.filter((l) => l.prioridade > 0) : linhas;
    const arr = [...base];
    if (ordenacao === "prioridade") {
      arr.sort((a, b) => b.prioridade - a.prioridade || a.titulo.localeCompare(b.titulo, "pt-BR"));
    } else {
      arr.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
    }
    return arr;
  }

  function desenhar() {
    const avaliados = linhas.filter((l) => l.prioridade > 0).length;
    stats.textContent = `${avaliados} priorizados de ${linhas.length}`;

    const arr = linhasVisiveis();
    body.innerHTML = arr.length
      ? arr.map((l, i) => rowHtml(l, i)).join("")
      : `<tr><td colspan="4" class="empty">Nenhum projeto nesse filtro.</td></tr>`;

    arr.forEach((l) => wireDots(l));
  }

  function rowHtml(l, i) {
    return `<tr class="${l.prioridade ? "is-rated" : ""}" data-titulo="${esc(l.titulo)}">
      <td class="num">${i + 1}</td>
      <td class="name">${esc(l.titulo)}</td>
      <td class="rating">
        <div style="display:flex;align-items:center;justify-content:center;gap:6px">
          <span class="org-prio-badge ${l.prioridade ? "has" : ""}" data-badge>${l.prioridade || "—"}</span>
          <div class="dot-group" data-dots></div>
        </div>
      </td>
      <td class="obs"><textarea class="obs-input" rows="1" placeholder="Observações…" data-obs>${esc(l.observacao)}</textarea></td>
    </tr>`;
  }

  function wireDots(l) {
    const tr = body.querySelector(`tr[data-titulo="${CSS.escape(l.titulo)}"]`);
    if (!tr) return;
    const dotsEl = tr.querySelector("[data-dots]");
    const badgeEl = tr.querySelector("[data-badge]");

    function pintarDots(s) {
      dotsEl.innerHTML = "";
      for (let v = 1; v <= 10; v++) {
        const b = document.createElement("button");
        b.type = "button";
        b.title = `Prioridade ${v}`;
        b.textContent = v;
        if (v <= s) b.classList.add("active", corFaixa(v, s));
        b.addEventListener("click", () => setRating(v));
        b.addEventListener("mouseenter", () => espiarDots(v));
        b.addEventListener("mouseleave", () => pintarDots(l.prioridade));
        dotsEl.appendChild(b);
      }
    }
    function espiarDots(hv) {
      [...dotsEl.children].forEach((b, idx) => {
        const v = idx + 1;
        b.className = v <= hv ? `active ${corFaixa(v, hv)} peek` : "";
      });
    }
    async function setRating(v) {
      const next = l.prioridade === v ? 0 : v;
      l.prioridade = next;
      await store.setPrioridade(l.titulo, { prioridade: next });
      pintarDots(next);
      badgeEl.textContent = next || "—";
      badgeEl.classList.toggle("has", !!next);
      tr.classList.toggle("is-rated", !!next);
      stats.textContent = `${linhas.filter((x) => x.prioridade > 0).length} priorizados de ${linhas.length}`;
    }

    pintarDots(l.prioridade);

    const obsEl = tr.querySelector("[data-obs]");
    obsEl.addEventListener("change", async () => {
      l.observacao = obsEl.value;
      await store.setPrioridade(l.titulo, { observacao: obsEl.value });
    });
  }

  desenhar();

  cont.querySelector("#org-proj-filtros").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-f]");
    if (!btn) return;
    filtro = btn.dataset.f;
    cont.querySelectorAll("#org-proj-filtros .chip").forEach((c) => c.classList.toggle("active", c === btn));
    desenhar();
  });
  cont.querySelector("#org-proj-ordem").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-o]");
    if (!btn) return;
    ordenacao = btn.dataset.o;
    cont.querySelectorAll("#org-proj-ordem .chip").forEach((c) => c.classList.toggle("active", c === btn));
    desenhar();
  });
}
