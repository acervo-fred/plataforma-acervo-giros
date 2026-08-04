/* Seletor de pastas em árvore — escaneia uma pasta/mídia externa
   conectada (File System Access API, Chrome/Edge) e mostra a árvore
   de subpastas, expansível como no Finder, com checkbox + tipo de
   material + campo de conteúdo por pasta (cada pasta marcada define
   seu próprio tipo). Módulo genérico: quem chama decide o que fazer
   com as pastas marcadas via onSalvar — usado no cadastro de pastas
   de uma Mídia (Estrutura). */

import { esc, compararNomes } from "./dom.js";

const LIMITE_PASTAS = 4000;
const IGNORAR = new Set([
  "$RECYCLE.BIN", "System Volume Information", ".Trashes", ".fseventsd",
  ".Spotlight-V100", ".TemporaryItems", ".DocumentRevisions-V100", ".apdisk",
]);

export function suportaSelecaoPastas() {
  return typeof window.showDirectoryPicker === "function";
}

function novoNo(nome, caminho) {
  return { nome, caminho, filhos: [], incluir: false, conteudo: "", tipoMaterial: "", aberto: false };
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
  entradas.sort((a, b) => compararNomes(a.name, b.name));
  for (const handle of entradas) {
    if (contador.n >= LIMITE_PASTAS) break;
    const filho = novoNo(handle.name, `${no.caminho}/${handle.name}`);
    no.filhos.push(filho);
    mapaNos.set(filho.caminho, filho);
    contador.n++;
    await escanearArvore(handle, filho, mapaNos, contador);
  }
}

function marcarRecursivo(no, valor, jaCadastrados) {
  if (!jaCadastrados.has(no.caminho)) no.incluir = valor;
  no.filhos.forEach((f) => marcarRecursivo(f, valor, jaCadastrados));
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

function renderNo(no, profundidade, filtrando, jaCadastrados, tiposMaterial) {
  if (filtrando && !no._visivel) return "";
  const temFilhos = no.filhos.length > 0;
  const abertoEfetivo = filtrando ? (no.aberto || no._forcarAberto) : no.aberto;
  const indent = profundidade * 20;
  const duplicado = jaCadastrados.has(no.caminho);

  return `<div class="tm-node" data-caminho="${esc(no.caminho)}">
    <div class="tm-node-row${duplicado ? " tm-node-row--dup" : ""}" style="padding-left:${indent}px">
      <button type="button" class="tm-caret${temFilhos ? "" : " tm-caret--vazio"}" data-toggle="${esc(no.caminho)}" ${temFilhos ? "" : `tabindex="-1"`}>${temFilhos ? (abertoEfetivo ? "▾" : "▸") : ""}</button>
      <input type="checkbox" data-incluir="${esc(no.caminho)}" ${no.incluir ? "checked" : ""} ${duplicado ? "disabled" : ""} />
      <svg class="tm-node-ic" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>
      <span class="tm-node-nome" title="${esc(no.caminho)}">${esc(no.nome)}</span>
      ${duplicado
        ? `<span class="tm-node-dup-tag" title="Já existe na Estrutura desta mídia">já cadastrada</span>`
        : `<select class="input tm-node-tipo" data-tipo="${esc(no.caminho)}">
            <option value="">Tipo de material</option>
            ${tiposMaterial.map((t) => `<option value="${esc(t)}" ${no.tipoMaterial === t ? "selected" : ""}>${esc(t)}</option>`).join("")}
          </select>
          <input type="text" class="input tm-node-conteudo" data-conteudo="${esc(no.caminho)}" value="${esc(no.conteudo)}" placeholder="Conteúdo desta pasta" />`}
    </div>
    ${temFilhos ? `<div class="tm-node-filhos" ${abertoEfetivo ? "" : `style="display:none"`}>${no.filhos.map((f) => renderNo(f, profundidade + 1, filtrando, jaCadastrados, tiposMaterial)).join("")}</div>` : ""}
  </div>`;
}

/* Monta o seletor dentro de `container`. opts:
   - onSalvar(marcados, raizAtual): recebe os nós marcados
     ([{ caminho, conteudo }]) e faz a gravação; pode ser async. Se
     lançar erro, a árvore não é podada (nada se perde).
   - caminhosExistentes: array de caminhos já cadastrados — ficam
     marcados como "já cadastrada" na árvore, com a marcação
     desabilitada (não dá pra selecionar de novo o mesmo caminho).
   - textoBotaoEscanear / textoBotaoSalvar: rótulos dos botões.
   - onSalvo(qtd, raizAtual): chamado depois de salvar+podar com sucesso. */
export function montarSeletorPastas(container, opts = {}) {
  const {
    onSalvar,
    caminhosExistentes = [],
    tiposMaterial = [],
    textoBotaoEscanear = "Abrir dispositivo externo",
    textoBotaoSalvar = "Salvar pastas marcadas",
    onSalvo,
  } = opts;

  const jaCadastrados = new Set(caminhosExistentes);
  let raiz = null;
  let mapaNos = new Map();
  let buscaArvore = "";
  let raizAtual = "";

  container.innerHTML = `
    <div class="toolbar" style="margin-bottom:14px">
      <button class="btn btn-primary" id="tm-btn-escanear" ${suportaSelecaoPastas() ? "" : "disabled"}>${esc(textoBotaoEscanear)}</button>
    </div>
    ${!suportaSelecaoPastas() ? `<div class="note"><span class="note-i">ⓘ</span> Esse navegador não sabe ler pastas do computador. Abra pelo Google Chrome.</div>` : ""}
    <div id="tm-area"></div>
  `;

  const area = container.querySelector("#tm-area");

  container.querySelector("#tm-btn-escanear")?.addEventListener("click", async () => {
    let dirHandle;
    try {
      dirHandle = await window.showDirectoryPicker();
    } catch {
      return; // cancelado pelo usuário
    }
    raizAtual = dirHandle.name;
    buscaArvore = "";
    area.innerHTML = `<div class="empty">Lendo pastas…</div>`;

    raiz = novoNo(dirHandle.name, raizAtual);
    raiz.aberto = true;
    mapaNos = new Map([[raiz.caminho, raiz]]);
    const contador = { n: 1 };
    await escanearArvore(dirHandle, raiz, mapaNos, contador);
    desenharShell();
  });

  function desenharShell() {
    if (!raiz) { area.innerHTML = ""; return; }

    area.innerHTML = `
      <div class="section-head"><h2 id="tm-titulo" style="font-size:15px"></h2></div>
      <div class="note" id="tm-aviso-truncado" style="display:none"><span class="note-i">ⓘ</span> Muitas pastas — mostrando só as ${LIMITE_PASTAS} primeiras.</div>
      <div class="toolbar" style="margin-bottom:10px; gap:14px">
        <input class="input" id="tm-busca" type="search" placeholder="Filtrar caminhos…" style="flex:1;min-width:200px" />
        <label class="tm-marcar-todas-lbl"><input type="checkbox" id="tm-marcar-todas" /> Marcar tudo</label>
        <span class="muted" id="tm-contagem" style="font-size:12.5px"></span>
      </div>
      <div class="tm-tree" id="tm-tree"></div>
      <div class="toolbar" style="margin-top:12px">
        <button class="btn btn-primary" id="tm-btn-salvar" disabled>${esc(textoBotaoSalvar)}</button>
      </div>
    `;

    area.querySelector("#tm-busca").addEventListener("input", (e) => {
      buscaArvore = e.target.value;
      redesenharTree();
    });
    area.querySelector("#tm-marcar-todas").addEventListener("change", (e) => {
      marcarRecursivo(raiz, e.target.checked, jaCadastrados);
      redesenharTree();
    });
    area.querySelector("#tm-btn-salvar").addEventListener("click", salvarMarcados);

    const treeEl = area.querySelector("#tm-tree");
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
      if (!cb || cb.disabled) return;
      const no = mapaNos.get(cb.dataset.incluir);
      if (no) no.incluir = cb.checked;
      atualizarContagem();
    });
    treeEl.addEventListener("input", (e) => {
      const inp = e.target.closest("[data-conteudo]");
      if (!inp) return;
      const no = mapaNos.get(inp.dataset.conteudo);
      if (!no) return;
      no.conteudo = inp.value;
      // começar a escrever já marca a pasta, sem precisar clicar no checkbox
      if (inp.value.trim() && !no.incluir) {
        no.incluir = true;
        const cb = inp.closest(".tm-node-row")?.querySelector("[data-incluir]");
        if (cb) cb.checked = true;
        atualizarContagem();
      }
    });
    treeEl.addEventListener("change", (e) => {
      const sel = e.target.closest("[data-tipo]");
      if (!sel) return;
      const no = mapaNos.get(sel.dataset.tipo);
      if (!no) return;
      no.tipoMaterial = sel.value;
      // escolher o tipo já marca a pasta, sem precisar clicar no checkbox
      if (sel.value && !no.incluir) {
        no.incluir = true;
        const cb = sel.closest(".tm-node-row")?.querySelector("[data-incluir]");
        if (cb) cb.checked = true;
        atualizarContagem();
      }
    });

    redesenharTree();
  }

  function redesenharTree() {
    const total = mapaNos.size;
    const truncado = total >= LIMITE_PASTAS;
    area.querySelector("#tm-titulo").textContent = `Pastas encontradas em "${raizAtual}" (${total})`;
    area.querySelector("#tm-aviso-truncado").style.display = truncado ? "flex" : "none";

    const termo = buscaArvore.trim().toLowerCase();
    if (termo) calcularVisibilidade(raiz, termo);
    else limparVisibilidade(raiz);

    area.querySelector("#tm-tree").innerHTML = renderNo(raiz, 0, !!termo, jaCadastrados, tiposMaterial);
    atualizarContagem();
  }

  function atualizarContagem() {
    const out = [];
    if (raiz) coletarMarcados(raiz, out);
    const span = area.querySelector("#tm-contagem");
    const btn = area.querySelector("#tm-btn-salvar");
    if (span) span.textContent = out.length ? `${out.length} marcada${out.length > 1 ? "s" : ""}` : "";
    if (btn) btn.disabled = out.length === 0;
  }

  async function salvarMarcados() {
    const marcados = [];
    coletarMarcados(raiz, marcados);
    if (!marcados.length) return;
    const btn = area.querySelector("#tm-btn-salvar");
    btn.disabled = true;
    btn.textContent = "Salvando…";
    try {
      await onSalvar?.(marcados.map((no) => ({ caminho: no.caminho, conteudo: no.conteudo, tipoMaterial: no.tipoMaterial })), raizAtual);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = textoBotaoSalvar;
      throw err;
    }

    marcados.forEach((no) => jaCadastrados.add(no.caminho));
    raiz.incluir = false; // a raiz não some da árvore, só desmarca
    podarMarcados(raiz);
    mapaNos = reconstruirMapa(raiz, new Map());
    onSalvo?.(marcados.length, raizAtual);
    btn.textContent = textoBotaoSalvar;
    redesenharTree();
  }
}
