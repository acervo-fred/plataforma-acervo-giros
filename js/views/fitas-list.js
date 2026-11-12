/* Fitas & outros — inventário de mídias físicas (fitas, CDs, DATs…).
   Colunas iguais às da planilha de levantamento (sem "data" e "quem fez"):
   Local · Tipo · Subtipo · Master · Nome na fita · Duração · Obs.
   + Avaliada (vem da página avaliacao-fitas.html, RTDB público, só leitura)
   + Digitalização (menu: Em processo / Digitalizada — alimenta o Dashboard).
   Cabeçalhos clicáveis ordenam; Master e Digitalização são menus na própria linha. */

import { store } from "../data/store.js";
import { esc, compararNomes, toast } from "../ui/dom.js";
import { abrirNovaFita } from "./cadastros.js";

export const MASTER_OPCOES = [
  { valor: "", rotulo: "—" },
  { valor: "s", rotulo: "Master" },
  { valor: "n/s", rotulo: "Talvez" },
  { valor: "n", rotulo: "Não" },
];
const MASTER_ORDEM = { s: 0, "n/s": 1, n: 2, "": 3 };
export const DIGI_OPCOES = [
  { valor: "", rotulo: "—" },
  { valor: "Em processo", rotulo: "Em processo" },
  { valor: "Digitalizada", rotulo: "Digitalizada" },
];
const DIGI_ORDEM = { "Em processo": 0, Digitalizada: 1 };

// Avaliações feitas em avaliacao-fitas.html: {avaliador: {nome, notas: {chaveFita: {p, obs}}}}
const AVALIACOES_URL = "https://giros-imagens-default-rtdb.firebaseio.com/acervo/fitas_avaliacao.json";
const chaveAval = (id) => String(id).replace(/[.#$\[\]\/:]/g, "_");
async function carregarAvaliacoes() {
  try {
    const r = await fetch(AVALIACOES_URL, { cache: "no-store" });
    const todos = (await r.json()) || {};
    const por = {};
    for (const [pid, a] of Object.entries(todos)) {
      for (const [k, n] of Object.entries(a?.notas || {})) {
        if (!n || (!n.p && !n.obs)) continue;
        (por[k] ||= []).push({ nome: a.nome || pid, p: n.p || 0, obs: n.obs || "" });
      }
    }
    return por;
  } catch (e) {
    console.warn("Avaliações indisponíveis:", e);
    return null;
  }
}

const COLUNAS = [
  { k: "local", t: "Local" },
  { k: "tipo", t: "Tipo" },
  { k: "subtipo", t: "Subtipo" },
  { k: "master", t: "Master" },
  { k: "avaliada", t: "Avaliada" },
  { k: "digitalizacao", t: "Digitalização" },
  { k: "nome", t: "Nome na fita" },
  { k: "duracao", t: "Duração" },
  { k: "obs", t: "Obs" },
];

// "51'44\"", "49 min", "24", "31:42:00", "00h01m16s" → segundos (p/ ordenar)
export function duracaoSegundos(txt) {
  const s = String(txt || "").trim().toLowerCase();
  if (!s) return null;
  const n = (s.match(/\d+/g) || []).map(Number);
  if (!n.length) return null;
  const hms = s.match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*m(?!in))?\s*(?:(\d+)\s*s)?/);
  if (/\d\s*h|\d\s*m(?!in)|\d\s*s\b/.test(s) && hms) return (+hms[1] || 0) * 3600 + (+hms[2] || 0) * 60 + (+hms[3] || 0);
  if (s.includes(":")) {
    if (n.length >= 3 && n[0] < 10) return n[0] * 3600 + n[1] * 60 + n[2];
    return n[0] * 60 + (n[1] || 0);   // mm:ss(:quadros)
  }
  if (s.includes("'")) return n[0] * 60 + (n[1] || 0);
  return n[0] * 60;                   // "49 min", "24", "53\"" → minutos
}

const semPontuacao = (v) => String(v).replace(/^[^\p{L}\p{N}]+/u, "");
function valorOrdem(f, k) {
  if (k === "master") return f.master ? MASTER_ORDEM[f.master] : null;
  if (k === "duracao") return duracaoSegundos(f.duracao);
  if (k === "avaliada") return f._aval ? -Math.max(...f._aval.map((a) => a.p)) : null;  // maior prioridade primeiro
  if (k === "digitalizacao") return f.digitalizacao ? DIGI_ORDEM[f.digitalizacao] : null;
  return f[k] ? semPontuacao(f[k]) : null;
}
// vazios sempre no fim, em qualquer direção
function comparar(a, b, k, dir) {
  const x = valorOrdem(a, k), y = valorOrdem(b, k);
  if (x === null || y === null) return (x === null) - (y === null);
  return (typeof x === "number" ? x - y : compararNomes(x, y)) * dir;
}

export async function renderFitasLista(app) {
  const [fitas, avaliacoes] = await Promise.all([store.listFitas(), carregarAvaliacoes()]);
  fitas.forEach((f, i) => { f._ordem = i; f._aval = avaliacoes?.[chaveAval(f.id)] || null; });
  let busca = "", fTipo = "", fLocal = "", fMaster = "*", fAval = "", fDigi = "*";
  let ordem = { k: "", dir: 1 };

  const unicos = (k) => [...new Set(fitas.map((f) => f[k]).filter(Boolean))].sort(compararNomes);
  const tipos = unicos("tipo"), locais = unicos("local");
  const contagem = {};
  fitas.forEach((f) => { const t = (f.tipo || "—").replace(/\s*\[\?\]$/, ""); contagem[t] = (contagem[t] || 0) + 1; });
  const principais = Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const metaCell = (l, v) => `<div class="meta-cell"><div class="meta-label">${l}</div><div class="meta-value"><span style="font-size:22px;font-weight:700">${v}</span></div></div>`;

  app.innerHTML = `
    <div class="page-head">
      <div><h1 class="page-title">Fitas <span class="title-complemento">&amp; outros</span></h1>
        <div class="page-sub">Inventário de mídias físicas</div></div>
      <div class="toolbar edit-only" style="gap:8px">
        <button class="btn btn-primary" data-act="nova-fita">+ Nova fita</button>
      </div>
    </div>
    <div class="meta-grid">
      ${metaCell("Total", fitas.length)}
      ${metaCell("Master", fitas.filter((f) => f.master === "s").length)}
      ${metaCell("Avaliadas", avaliacoes ? fitas.filter((f) => f._aval).length : "—")}
      ${metaCell("Em processo", fitas.filter((f) => f.digitalizacao === "Em processo").length)}
      ${metaCell("Digitalizadas", fitas.filter((f) => f.digitalizacao === "Digitalizada").length)}
      ${principais.slice(0, 3).map(([t, n]) => metaCell(esc(t), n)).join("")}
    </div>
    <div class="toolbar" style="margin-bottom:16px; gap:10px; flex-wrap:wrap">
      <input class="input" id="busca" type="search" placeholder="Buscar por nome, local ou obs…" style="flex:1;min-width:180px" />
      <select class="input" id="f-tipo" style="width:auto"><option value="">Todos os tipos</option>
        ${tipos.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}</select>
      <select class="input" id="f-local" style="width:auto"><option value="">Todos os locais</option>
        ${locais.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}</select>
      <select class="input" id="f-master" style="width:auto"><option value="*">Master: todos</option>
        ${MASTER_OPCOES.map((o) => `<option value="${o.valor}">${o.valor ? o.rotulo : "Em branco"}</option>`).join("")}</select>
      <select class="input" id="f-aval" style="width:auto"><option value="">Avaliação: todas</option>
        <option value="s">Avaliadas</option><option value="n">Não avaliadas</option></select>
      <select class="input" id="f-digi" style="width:auto"><option value="*">Digitalização: todas</option>
        ${DIGI_OPCOES.map((o) => `<option value="${o.valor}">${o.valor ? o.rotulo : "Não enviada"}</option>`).join("")}</select>
      <span class="muted" id="qtd" style="font-size:13px"></span>
    </div>
    <div class="list-card fitas-tabela-wrap">
      <table class="data-table fitas-tabela">
        <thead><tr>
          ${COLUNAS.map((c) => `<th><button type="button" class="th-sort" data-k="${c.k}">${c.t}<span class="th-seta"></span></button></th>`).join("")}
          <th class="col-acoes"></th>
        </tr></thead>
        <tbody id="corpo"></tbody>
      </table>
    </div>
  `;

  const corpo = app.querySelector("#corpo");
  const porId = Object.fromEntries(fitas.map((f) => [f.id, f]));

  function filtradas() {
    const t = busca.trim().toLowerCase();
    const arr = fitas.filter((f) => {
      if (fTipo && f.tipo !== fTipo) return false;
      if (fLocal && f.local !== fLocal) return false;
      if (fMaster !== "*" && (f.master || "") !== fMaster) return false;
      if (fAval && !!f._aval !== (fAval === "s")) return false;
      if (fDigi !== "*" && (f.digitalizacao || "") !== fDigi) return false;
      if (t && ![f.nome, f.local, f.obs, f.tipo].some((v) => (v || "").toLowerCase().includes(t))) return false;
      return true;
    });
    if (ordem.k) arr.sort((a, b) => comparar(a, b, ordem.k, ordem.dir) || a._ordem - b._ordem);
    return arr;
  }

  function desenhar() {
    const arr = filtradas();
    app.querySelector("#qtd").textContent = arr.length === fitas.length ? "" : `${arr.length} de ${fitas.length}`;
    app.querySelectorAll(".th-sort").forEach((b) => {
      const ativo = b.dataset.k === ordem.k;
      b.classList.toggle("ativo", ativo);
      b.querySelector(".th-seta").textContent = ativo ? (ordem.dir > 0 ? " ↑" : " ↓") : "";
    });
    corpo.innerHTML = arr.length
      ? arr.map(linha).join("")
      : `<tr><td colspan="${COLUNAS.length + 1}"><div class="empty">Nenhuma fita encontrada.</div></td></tr>`;
  }
  desenhar();

  app.querySelector("#busca").addEventListener("input", (e) => { busca = e.target.value; desenhar(); });
  app.querySelector("#f-tipo").addEventListener("change", (e) => { fTipo = e.target.value; desenhar(); });
  app.querySelector("#f-local").addEventListener("change", (e) => { fLocal = e.target.value; desenhar(); });
  app.querySelector("#f-master").addEventListener("change", (e) => { fMaster = e.target.value; desenhar(); });
  app.querySelector("#f-aval").addEventListener("change", (e) => { fAval = e.target.value; desenhar(); });
  app.querySelector("#f-digi").addEventListener("change", (e) => { fDigi = e.target.value; desenhar(); });
  app.querySelector("thead").addEventListener("click", (e) => {
    const b = e.target.closest(".th-sort");
    if (!b) return;
    // 1º clique: crescente · 2º: decrescente · 3º: volta à ordem da planilha
    if (ordem.k !== b.dataset.k) ordem = { k: b.dataset.k, dir: 1 };
    else if (ordem.dir > 0) ordem.dir = -1;
    else ordem = { k: "", dir: 1 };
    desenhar();
  });
  app.querySelector('[data-act="nova-fita"]').addEventListener("click", () => abrirNovaFita());

  // Master e Digitalização direto na linha
  corpo.addEventListener("change", async (e) => {
    const sel = e.target.closest("select.master-sel, select.digi-sel");
    if (!sel) return;
    const campo = sel.classList.contains("digi-sel") ? "digitalizacao" : "master";
    const f = porId[sel.dataset.id], antes = f[campo] || "";
    sel.disabled = true;
    try {
      await store.updateFita(f.id, { [campo]: sel.value });
      f[campo] = sel.value;
      sel.dataset.v = sel.value;
    } catch (err) {
      sel.value = antes;
      toast("Não foi possível salvar: " + (err.message || err));
    }
    sel.disabled = false;
  });

  corpo.addEventListener("click", async (e) => {
    const ed = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-del]");
    if (ed) return abrirNovaFita(porId[ed.dataset.id]);
    if (del) {
      const f = porId[del.dataset.id];
      if (!confirm(`Excluir a fita "${f.nome}"?`)) return;
      await store.removeFita(f.id);
      window.dispatchEvent(new CustomEvent("data-changed"));
    }
  });
}

function masterSelect(f) {
  const v = f.master || "";
  return `<select class="master-sel edit-only-inert" data-id="${esc(f.id)}" data-v="${esc(v)}" aria-label="Master">
    ${MASTER_OPCOES.map((o) => `<option value="${o.valor}" ${o.valor === v ? "selected" : ""}>${o.rotulo}</option>`).join("")}
  </select>`;
}

function digiSelect(f) {
  const v = f.digitalizacao || "";
  return `<select class="master-sel digi-sel edit-only-inert" data-id="${esc(f.id)}" data-v="${esc(v)}" aria-label="Digitalização">
    ${DIGI_OPCOES.map((o) => `<option value="${o.valor}" ${o.valor === v ? "selected" : ""}>${o.rotulo}</option>`).join("")}
  </select>`;
}

function avalCelula(f) {
  if (!f._aval) return "";
  const max = Math.max(...f._aval.map((a) => a.p));
  const dica = f._aval.map((a) => `${a.nome}: prioridade ${a.p || "—"}${a.obs ? " — " + a.obs : ""}`).join("\n");
  return `<span class="aval-ok" title="${esc(dica)}">✓${max ? ` <span class="aval-p">${max}</span>` : ""}</span>`;
}

function linha(f) {
  return `<tr>
    <td class="col-f-local">${esc(f.local)}</td>
    <td class="col-f-tipo">${esc(f.tipo)}</td>
    <td class="col-f-sub">${esc(f.subtipo)}</td>
    <td class="col-f-master">${masterSelect(f)}</td>
    <td class="col-f-aval">${avalCelula(f)}</td>
    <td class="col-f-master">${digiSelect(f)}</td>
    <td class="col-f-nome">${esc(f.nome)}</td>
    <td class="col-f-dur">${esc(f.duracao)}</td>
    <td class="col-f-obs">${esc(f.obs)}</td>
    <td class="col-acoes"><span class="lr-actions edit-only">
      <button class="icon-btn" data-edit data-id="${esc(f.id)}" title="Editar"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
      <button class="icon-btn danger" data-del data-id="${esc(f.id)}" title="Excluir"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
    </span></td>
  </tr>`;
}
