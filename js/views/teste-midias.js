/* Teste Mídias — aba experimental pra testar o cadastro automático de
   pastas. Lê a árvore de pastas de uma mídia externa conectada (via
   File System Access API, só funciona no Chrome/Edge), mostra tudo
   como uma árvore que abre/fecha (igual Finder) pra deixar clara a
   relação pasta-mãe/subpasta, deixa marcar quais incluir e escrever
   o conteúdo de cada uma, e salva numa coleção própria
   (acervo_testeMidias) — nunca toca em Mídias nem em Estrutura, pra
   poder validar a ideia sem risco. */

import { store } from "../data/store.js";
import { esc } from "../ui/dom.js";

const LIMITE_PASTAS = 4000;
const IGNORAR = new Set([
  "$RECYCLE.BIN", "System Volume Information", ".Trashes", ".fseventsd",
  ".Spotlight-V100", ".TemporaryItems", ".DocumentRevisions-V100", ".apdisk",
]);

function suportado() {
  return typeof window.showDirectoryPicker === "function";
}

function novoNo(nome, caminho) {
  return { nome, caminho, filhos: [], incluir: false, conteudo: "", aberto: false };
}

// varre recursivamente, ignorando pastas ocultas/de sistema; para de
// descer quando bate o limite (evita travar em HDs com muitos níveis)
async function escanearArvore(dirHandle, no, mapaNos, contador) {
  if (contador.n >= LIMITE_PASTAS) return;
  const entradas = [];
  for await (const handle of dirHandle.values()) {
    if (handle.kind !== "directory") continue;
    if (handle.name.startsWith(".") || IGNORAR.has(handle.name)) continue;
    entradas.push(handle);
  }
  entradas.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  for (const handle of entradas) {
    if (contador.n >= LIMITE_PASTAS) break;
    const filho = novoNo(handle.name, `${no.caminho}/${handle.name}`);
    no.filhos.push(filho);
    mapaNos.set(filho.caminho, filho);
    contador.n++;
    await escanearArvore(handle, filho, mapaNos, contador);
  }
}

function marcarRecursivo(no, valor) {
  no.incluir = valor;
  no.filhos.forEach((f) => marcarRecursivo(f, valor));
}

function coletarMarcados(no, out) {
  if (no.incluir) out.push(no);
  no.filhos.forEach((f) => coletarMarcados(f, out));
}

// some com quem já foi salvo, mantendo o resto da árvore intacto
function podarMarcados(no) {
  no.filhos = no.filhos.filter((f) => {
    if (f.incluir) return false;
    podarMarcados(f);
    return true;
  });
}

function reconstruirMapa(no, mapa) {
  mapa.set(no.caminho, no);
  no.filhos.forEach((f) => reconstruirMapa(f, mapa));
  return mapa;
}

// filtro por texto: um nó fica visível se o caminho dele bate com o
// termo OU algum descendente bate — e nesse 2º caso força a abertura
// (sem alterar o "aberto" manual) só pra revelar quem deu match
function calcularVisibilidade(no, termo) {
  const nomeMatch = no.caminho.toLowerCase().includes(termo);
  let filhoVisivel = false;
  for (const f of no.filhos) {
    if (calcularVisibilidade(f, termo)) filhoVisivel = true;
  }
  no._visivel = nomeMatch || filhoVisivel;
  no._forcarAberto = filhoVisivel;
  return no._visivel;
}
function limparVisibilidade(no) {
  no._visivel = true;
  no._forcarAberto = false;
  no.filhos.forEach(limparVisibilidade);
}

export async function renderTesteMidias(app) {
  const salvas = await store.listTesteMidias();

  let raiz = null;
  let mapaNos = new Map();
  let buscaArvore = "";
  let raizAtual = "";

  app.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Teste Mídias</h1>
        <div class="page-sub">Área experimental para testar o cadastro automático de pastas — não afeta Mídias nem Estrutura.</div>
      </div>
      <div class="toolbar" style="gap:8px">
        <button class="btn btn-primary" id="btn-escanear" ${suportado() ? "" : "disabled"}>Selecionar pasta da mídia</button>
      </div>
    </div>

    ${!suportado() ? `<div class="note"><span class="note-i">ⓘ</span> Esse navegador não sabe ler pastas do computador. Abra pelo Google Chrome.</div>` : ""}

    <div id="area-scan"></div>

    <div class="section-head"><h2>Pastas já salvas neste teste</h2></div>
    <div class="list-card" id="lista-salvas"></div>
  `;

  const areaScan = app.querySelector("#area-scan");
  const listaSalvas = app.querySelector("#lista-salvas");

  function desenharSalvas() {
    listaSalvas.innerHTML = salvas.length
      ? salvas.map((s) => rowSalva(s)).join("")
      : `<div class="empty">Nenhuma pasta salva ainda neste teste.</div>`;
  }
  desenharSalvas();

  listaSalvas.addEventListener("click", async (e) => {
    const del = e.target.closest("[data-del]");
    if (!del) return;
    const s = salvas.find((x) => x.id === del.dataset.id);
    if (!s) return;
    if (!confirm(`Remover "${s.caminho}" deste teste?`)) return;
    await store.removeTesteMidia(s.id);
    salvas.splice(salvas.indexOf(s), 1);
    desenharSalvas();
  });

  listaSalvas.addEventListener("input", (e) => {
    const txt = e.target.closest("[data-conteudo-id]");
    if (!txt) return;
    const s = salvas.find((x) => x.id === txt.dataset.conteudoId);
    if (s) s.conteudo = txt.value;
  });
  listaSalvas.addEventListener("change", async (e) => {
    const txt = e.target.closest("[data-conteudo-id]");
    if (!txt) return;
    await store.updateTesteMidia(txt.dataset.conteudoId, { conteudo: txt.value });
  });

  app.querySelector("#btn-escanear")?.addEventListener("click", async () => {
    let dirHandle;
    try {
      dirHandle = await window.showDirectoryPicker();
    } catch {
      return; // cancelado pelo usuário
    }
    raizAtual = dirHandle.name;
    buscaArvore = "";
    areaScan.innerHTML = `<div class="empty">Lendo pastas…</div>`;

    raiz = novoNo(dirHandle.name, dirHandle.name);
    raiz.aberto = true;
    mapaNos = new Map([[raiz.caminho, raiz]]);
    const contador = { n: 1 };
    await escanearArvore(dirHandle, raiz, mapaNos, contador);
    desenharShell();
  });

  function desenharShell() {
    if (!raiz) { areaScan.innerHTML = ""; return; }

    areaScan.innerHTML = `
      <div class="section-head"><h2 id="tm-titulo"></h2></div>
      <div class="note" id="tm-aviso-truncado" style="display:none"><span class="note-i">ⓘ</span> Muitas pastas — mostrando só as ${LIMITE_PASTAS} primeiras.</div>
      <div class="toolbar" style="margin-bottom:10px; gap:14px">
        <input class="input" id="busca-arvore" type="search" placeholder="Filtrar caminhos…" style="flex:1;min-width:200px" />
        <label class="tm-marcar-todas-lbl"><input type="checkbox" id="tm-marcar-todas" /> Marcar tudo</label>
        <span class="muted" id="contagem-marcadas" style="font-size:12.5px"></span>
      </div>
      <div class="tm-tree" id="tm-tree"></div>
      <div class="toolbar" style="margin-top:12px">
        <button class="btn btn-primary" id="btn-salvar-marcadas" disabled>Salvar pastas marcadas</button>
      </div>
    `;

    areaScan.querySelector("#busca-arvore").addEventListener("input", (e) => {
      buscaArvore = e.target.value;
      redesenharTree();
    });
    areaScan.querySelector("#tm-marcar-todas").addEventListener("change", (e) => {
      marcarRecursivo(raiz, e.target.checked);
      redesenharTree();
    });
    areaScan.querySelector("#btn-salvar-marcadas").addEventListener("click", salvarMarcadas);

    const treeEl = areaScan.querySelector("#tm-tree");
    treeEl.addEventListener("click", (e) => {
      const caret = e.target.closest("[data-toggle]");
      if (!caret) return;
      const no = mapaNos.get(caret.dataset.toggle);
      if (!no || !no.filhos.length) return;
      no.aberto = !no.aberto;
      const noEl = caret.closest(".tm-node");
      const filhosEl = noEl.querySelector(":scope > .tm-node-filhos");
      if (filhosEl) filhosEl.style.display = no.aberto ? "" : "none";
      caret.textContent = no.aberto ? "▾" : "▸";
    });
    treeEl.addEventListener("change", (e) => {
      const cb = e.target.closest("[data-incluir]");
      if (!cb) return;
      const no = mapaNos.get(cb.dataset.incluir);
      if (no) no.incluir = cb.checked;
      atualizarContagem();
    });
    treeEl.addEventListener("input", (e) => {
      const inp = e.target.closest("[data-conteudo]");
      if (!inp) return;
      const no = mapaNos.get(inp.dataset.conteudo);
      if (no) no.conteudo = inp.value;
    });

    redesenharTree();
  }

  function redesenharTree() {
    const total = mapaNos.size;
    const truncado = total >= LIMITE_PASTAS;
    areaScan.querySelector("#tm-titulo").textContent = `Pastas encontradas em "${raizAtual}" (${total})`;
    areaScan.querySelector("#tm-aviso-truncado").style.display = truncado ? "flex" : "none";

    const termo = buscaArvore.trim().toLowerCase();
    if (termo) calcularVisibilidade(raiz, termo);
    else limparVisibilidade(raiz);

    areaScan.querySelector("#tm-tree").innerHTML = renderNo(raiz, 0, !!termo);
    atualizarContagem();
  }

  function atualizarContagem() {
    const out = [];
    if (raiz) coletarMarcados(raiz, out);
    const span = areaScan.querySelector("#contagem-marcadas");
    const btn = areaScan.querySelector("#btn-salvar-marcadas");
    if (span) span.textContent = out.length ? `${out.length} marcada${out.length > 1 ? "s" : ""}` : "";
    if (btn) btn.disabled = out.length === 0;
  }

  async function salvarMarcadas() {
    const marcadas = [];
    coletarMarcados(raiz, marcadas);
    if (!marcadas.length) return;
    const btn = areaScan.querySelector("#btn-salvar-marcadas");
    btn.disabled = true;
    btn.textContent = "Salvando…";
    const novas = await store.addTesteMidiasLote(
      marcadas.map((no) => ({ caminho: no.caminho, conteudo: no.conteudo, origem: raizAtual }))
    );
    salvas.push(...novas);
    desenharSalvas();

    raiz.incluir = false; // a raiz não some da árvore, só desmarca
    podarMarcados(raiz);
    mapaNos = reconstruirMapa(raiz, new Map());
    btn.textContent = "Salvar pastas marcadas";
    redesenharTree();
  }
}

function renderNo(no, profundidade, filtrando) {
  if (filtrando && !no._visivel) return "";
  const temFilhos = no.filhos.length > 0;
  const abertoEfetivo = filtrando ? (no.aberto || no._forcarAberto) : no.aberto;
  const indent = profundidade * 20;

  return `<div class="tm-node" data-caminho="${esc(no.caminho)}">
    <div class="tm-node-row" style="padding-left:${indent}px">
      <button type="button" class="tm-caret${temFilhos ? "" : " tm-caret--vazio"}" data-toggle="${esc(no.caminho)}" ${temFilhos ? "" : "tabindex=\"-1\""}>${temFilhos ? (abertoEfetivo ? "▾" : "▸") : ""}</button>
      <input type="checkbox" data-incluir="${esc(no.caminho)}" ${no.incluir ? "checked" : ""} />
      <svg class="tm-node-ic" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>
      <span class="tm-node-nome" title="${esc(no.caminho)}">${esc(no.nome)}</span>
      <input type="text" class="input tm-node-conteudo" data-conteudo="${esc(no.caminho)}" value="${esc(no.conteudo)}" placeholder="Conteúdo desta pasta" />
    </div>
    ${temFilhos ? `<div class="tm-node-filhos" ${abertoEfetivo ? "" : `style="display:none"`}>${no.filhos.map((f) => renderNo(f, profundidade + 1, filtrando)).join("")}</div>` : ""}
  </div>`;
}

function rowSalva(s) {
  return `<div class="list-row" data-id="${esc(s.id)}">
    <div class="lr-main">
      <span class="lr-title">${esc(s.caminho)}</span>
      ${s.origem ? `<span class="lr-sub muted">Mídia: ${esc(s.origem)}</span>` : ""}
    </div>
    <input type="text" class="input" data-conteudo-id="${esc(s.id)}" value="${esc(s.conteudo || "")}" placeholder="Conteúdo da pasta" style="max-width:280px" />
    <span class="lr-actions">
      <button class="icon-btn danger" data-del data-id="${esc(s.id)}" title="Remover"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
    </span>
  </div>`;
}
