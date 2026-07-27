/* Configurações — todas as listas de valores editáveis pelo usuário,
   sem depender de programador. Listas coloridas (status/prioridade)
   permitem escolher a cor do badge; as demais são texto simples.

   Cada categoria re-renderiza isoladamente (sem recarregar a página)
   para não perder a rolagem ao editar. */

import { store } from "../data/store.js";
import { esc } from "../ui/dom.js";
import { usuarioAtual } from "../data/auth.js";

const PALETA = ["gray", "blue", "amber", "green", "violet", "rose", "teal", "slate"];
const CORVAR = (c) => `var(--c-${c}-fg)`;

// categorias na ordem de exibição: { chave, titulo, colorida }
const CATEGORIAS = [
  { chave: "statusProjeto", titulo: "Status de projeto", colorida: true },
  { chave: "atividadeAtual", titulo: "Atividade atual", colorida: false },
  { chave: "statusPasta", titulo: "Status de pasta (estrutura)", colorida: true },
  { chave: "statusMidia", titulo: "Status de mídia", colorida: true },
  { chave: "statusDemanda", titulo: "Status de demanda", colorida: true },
  { chave: "prioridade", titulo: "Prioridades", colorida: true, hint: "Demandas" },
  { chave: "tipoMaterial", titulo: "Tipos de material", colorida: false, hint: "Pastas das mídias" },
  { chave: "tipoMidia", titulo: "Tipos de mídia", colorida: false },
  { chave: "acao", titulo: "Tipos de ação", colorida: false, hint: "Histórico" },
  { chave: "responsaveis", titulo: "Responsáveis", colorida: false, hint: "Demandas" },
  { chave: "locais", titulo: "Locais", colorida: false, hint: "Onde está a mídia" },
  { chave: "alfred", titulo: "ALFRED", colorida: false, hint: "Projetos" },
  { chave: "tipoFita", titulo: "Tipos de fita", colorida: false, hint: "Fitas" },
  { chave: "statusFita", titulo: "Status de fita", colorida: true, hint: "Fitas" },
  { chave: "locaisFita", titulo: "Locais de fita", colorida: false, hint: "Fitas — local físico" },
];

// estado de edição local (uma linha por vez em todo o sistema)
let editando = null; // { chave, index }  | index === -1 => novo

export async function renderConfig(app) {
  // página inteira é de edição — quem chegou aqui via URL direta sem
  // estar logado como editor não vê os formulários
  if (!usuarioAtual()) {
    app.innerHTML = `<a class="back-link" href="#/">← Voltar</a>
      <div class="empty">Esta área é restrita a quem está editando.</div>`;
    return;
  }

  const listas = await store.getListas();
  editando = null;

  app.innerHTML = `
    <div class="page-head">
      <div><h1 class="page-title">Configurações</h1>
        <div class="page-sub">Edite as listas de valores usadas nos formulários.</div></div>
      <div class="toolbar"><a class="btn" href="#/dados">Backup e dados →</a></div>
    </div>
    <div class="note"><span class="note-i">ⓘ</span>
      Alterar uma lista não muda os registros já salvos com o valor antigo.</div>
    <div class="config-grid" id="cfg-grid"></div>
  `;

  const grid = app.querySelector("#cfg-grid");
  grid.innerHTML = CATEGORIAS.map((c) =>
    `<div class="cfg-card" id="cfg-${c.chave}"></div>`
  ).join("");

  CATEGORIAS.forEach((cat) => desenhaCard(grid, cat, listas));
}

function desenhaCard(grid, cat, listas) {
  const card = grid.querySelector(`#cfg-${cat.chave}`);
  const itens = listas[cat.chave] || [];
  const editandoEsta = editando && editando.chave === cat.chave;

  const linhas = itens.map((it, i) => {
    if (editandoEsta && editando.index === i) return linhaEdicao(cat, valorDe(it), corDe(it));
    return linhaItem(cat, it, i);
  }).join("");

  const linhaNova = editandoEsta && editando.index === -1 ? linhaEdicao(cat, "", PALETA[0]) : "";
  const podeAdicionar = !editandoEsta || editando.index !== -1;

  card.innerHTML = `
    <div class="cfg-card-head">
      <h3>${esc(cat.titulo)}${cat.hint ? ` <span class="cfg-hint">${esc(cat.hint)}</span>` : ""}</h3>
      <span class="cfg-count">${itens.length}</span>
    </div>
    <div class="cfg-list">${linhas || `<div class="empty" style="padding:14px">Vazio</div>`}${linhaNova}</div>
    <div class="cfg-add">
      <button class="btn btn-sm" data-add ${podeAdicionar ? "" : "disabled"}>+ Adicionar</button>
    </div>
  `;

  // ----- liga eventos do card -----
  card.querySelector("[data-add]")?.addEventListener("click", () => {
    editando = { chave: cat.chave, index: -1 };
    desenhaCard(grid, cat, listas);
  });

  card.querySelectorAll("[data-edit]").forEach((b) =>
    b.addEventListener("click", () => {
      editando = { chave: cat.chave, index: Number(b.dataset.edit) };
      desenhaCard(grid, cat, listas);
    })
  );

  card.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      const i = Number(b.dataset.del);
      if (!confirm(`Remover "${valorDe(itens[i])}"?`)) return;
      const novos = itens.slice();
      novos.splice(i, 1);
      listas[cat.chave] = await store.saveLista(cat.chave, novos);
      editando = null;
      desenhaCard(grid, cat, listas);
    })
  );

  // formulário de edição (se houver)
  const formEl = card.querySelector(".cfg-edit");
  if (formEl) ligaEdicao(formEl, grid, cat, listas);
}

function ligaEdicao(formEl, grid, cat, listas) {
  const input = formEl.querySelector('input[type="text"]');
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);

  // seleção de cor
  formEl.querySelectorAll(".swatch-pick").forEach((sw) =>
    sw.addEventListener("click", () => {
      formEl.querySelectorAll(".swatch-pick").forEach((s) => s.classList.remove("sel"));
      sw.classList.add("sel");
    })
  );

  async function salvar() {
    const valor = input.value.trim();
    if (!valor) { input.focus(); return; }
    const idx = editando.index;
    const itens = listas[cat.chave] || [];
    // duplicado?
    const existe = itens.some((it, i) => i !== idx && valorDe(it).toLowerCase() === valor.toLowerCase());
    if (existe) { alert("Esse valor já existe nesta lista."); return; }

    let novoItem;
    if (cat.colorida) {
      const cor = formEl.querySelector(".swatch-pick.sel")?.dataset.cor || PALETA[0];
      novoItem = { valor, cor };
    } else {
      novoItem = valor;
    }
    const novos = itens.slice();
    if (idx === -1) novos.push(novoItem);
    else novos[idx] = novoItem;

    listas[cat.chave] = await store.saveLista(cat.chave, novos);
    editando = null;
    desenhaCard(grid, cat, listas);
  }

  function cancelar() { editando = null; desenhaCard(grid, cat, listas); }

  formEl.querySelector("[data-save]").addEventListener("click", salvar);
  formEl.querySelector("[data-cancel]").addEventListener("click", cancelar);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); salvar(); }
    else if (e.key === "Escape") { e.preventDefault(); cancelar(); }
  });
}

/* ---------- helpers de render ---------- */
function valorDe(it) { return typeof it === "string" ? it : it.valor; }
function corDe(it) { return typeof it === "string" ? null : it.cor; }

function linhaItem(cat, it, i) {
  const swatch = cat.colorida
    ? `<span class="cfg-swatch" style="background:${CORVAR(corDe(it) || "gray")}"></span>`
    : "";
  return `<div class="cfg-item">
    ${swatch}
    <span class="cfg-val">${esc(valorDe(it))}</span>
    <span class="cfg-actions">
      <button class="icon-btn" data-edit="${i}" title="Editar"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
      <button class="icon-btn danger" data-del="${i}" title="Remover"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
    </span>
  </div>`;
}

function linhaEdicao(cat, valor, corSel) {
  const swatches = cat.colorida
    ? `<div class="swatch-row">${PALETA.map((c) =>
        `<span class="swatch-pick ${c === corSel ? "sel" : ""}" data-cor="${c}"
           style="background:${CORVAR(c)}" title="${c}"></span>`).join("")}</div>`
    : "";
  return `<div class="cfg-edit">
    <input type="text" value="${esc(valor)}" placeholder="Valor" />
    ${swatches}
    <span class="cfg-edit-actions">
      <button class="btn btn-primary btn-sm" data-save>Salvar</button>
      <button class="btn btn-ghost btn-sm" data-cancel>Cancelar</button>
    </span>
  </div>`;
}
