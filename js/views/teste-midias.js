/* Teste Mídias — aba experimental pra testar o cadastro automático de
   pastas. Lê a árvore de pastas de uma mídia externa conectada (via
   File System Access API, só funciona no Chrome/Edge), deixa marcar
   quais pastas incluir e escrever o conteúdo de cada uma, e salva
   numa coleção própria (acervo_testeMidias) — nunca toca em Mídias
   nem em Estrutura, pra poder validar a ideia sem risco. */

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

// varre recursivamente, ignorando pastas ocultas/de sistema; para de
// descer quando bate o limite (evita travar em HDs com muitos níveis)
async function escanear(dirHandle, prefixo, out) {
  if (out.length >= LIMITE_PASTAS) return;
  for await (const handle of dirHandle.values()) {
    if (handle.kind !== "directory") continue;
    if (handle.name.startsWith(".") || IGNORAR.has(handle.name)) continue;
    const caminho = `${prefixo}/${handle.name}`;
    out.push(caminho);
    if (out.length >= LIMITE_PASTAS) return;
    await escanear(handle, caminho, out);
  }
}

export async function renderTesteMidias(app) {
  const salvas = await store.listTesteMidias();

  let encontradas = []; // [{ caminho, incluir, conteudo }]
  let buscaEncontradas = "";
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
    encontradas = [];
    buscaEncontradas = "";
    areaScan.innerHTML = `<div class="empty">Lendo pastas…</div>`;

    const caminhos = [dirHandle.name];
    await escanear(dirHandle, dirHandle.name, caminhos);
    encontradas = caminhos
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((caminho) => ({ caminho, incluir: false, conteudo: "" }));
    desenharScanShell();
  });

  function filtrarEncontradas() {
    const termo = buscaEncontradas.trim().toLowerCase();
    return termo ? encontradas.filter((f) => f.caminho.toLowerCase().includes(termo)) : encontradas;
  }

  function desenharScanShell() {
    if (!encontradas.length) { areaScan.innerHTML = ""; return; }
    const truncado = encontradas.length >= LIMITE_PASTAS;

    areaScan.innerHTML = `
      <div class="section-head"><h2>Pastas encontradas em "${esc(raizAtual)}" (${encontradas.length})</h2></div>
      ${truncado ? `<div class="note"><span class="note-i">ⓘ</span> Muitas pastas — mostrando só as ${LIMITE_PASTAS} primeiras.</div>` : ""}
      <div class="toolbar" style="margin-bottom:10px; gap:10px">
        <input class="input" id="busca-encontradas" type="search" placeholder="Filtrar caminhos…" style="flex:1;min-width:200px" />
        <span class="muted" id="contagem-marcadas" style="font-size:12.5px"></span>
      </div>
      <div class="tm-table-wrap">
        <table class="tm-table">
          <thead><tr>
            <th class="tm-check"><input type="checkbox" id="tm-marcar-todas" title="Marcar/desmarcar visíveis" /></th>
            <th>Caminho</th>
            <th>Conteúdo da pasta</th>
          </tr></thead>
          <tbody id="tm-body"></tbody>
        </table>
      </div>
      <div class="toolbar" style="margin-top:12px">
        <button class="btn btn-primary" id="btn-salvar-marcadas" disabled>Salvar pastas marcadas</button>
      </div>
    `;
    desenharLinhasScan();

    areaScan.querySelector("#busca-encontradas").addEventListener("input", (e) => {
      buscaEncontradas = e.target.value;
      desenharLinhasScan();
    });
    areaScan.querySelector("#tm-marcar-todas").addEventListener("change", (e) => {
      filtrarEncontradas().forEach((f) => { f.incluir = e.target.checked; });
      desenharLinhasScan();
    });
    areaScan.querySelector("#btn-salvar-marcadas").addEventListener("click", salvarMarcadas);
  }

  function desenharLinhasScan() {
    const body = areaScan.querySelector("#tm-body");
    const visiveis = filtrarEncontradas();
    body.innerHTML = visiveis.length
      ? visiveis.map((f) => rowScan(f)).join("")
      : `<tr><td colspan="3" class="empty">Nenhum caminho corresponde ao filtro.</td></tr>`;

    body.querySelectorAll("[data-incluir]").forEach((cb) => {
      cb.addEventListener("change", (e) => {
        const f = encontradas.find((x) => x.caminho === cb.dataset.incluir);
        if (f) f.incluir = e.target.checked;
        atualizarContagem();
      });
    });
    body.querySelectorAll("[data-conteudo]").forEach((inp) => {
      inp.addEventListener("input", (e) => {
        const f = encontradas.find((x) => x.caminho === inp.dataset.conteudo);
        if (f) f.conteudo = e.target.value;
      });
    });
    atualizarContagem();
  }

  function atualizarContagem() {
    const span = areaScan.querySelector("#contagem-marcadas");
    const btn = areaScan.querySelector("#btn-salvar-marcadas");
    const n = encontradas.filter((f) => f.incluir).length;
    if (span) span.textContent = n ? `${n} marcada${n > 1 ? "s" : ""}` : "";
    if (btn) btn.disabled = n === 0;
  }

  async function salvarMarcadas() {
    const marcadas = encontradas.filter((f) => f.incluir);
    if (!marcadas.length) return;
    const btn = areaScan.querySelector("#btn-salvar-marcadas");
    btn.disabled = true;
    btn.textContent = "Salvando…";
    const novas = await store.addTesteMidiasLote(
      marcadas.map((f) => ({ caminho: f.caminho, conteudo: f.conteudo, origem: raizAtual }))
    );
    salvas.push(...novas);
    desenharSalvas();
    encontradas = encontradas.filter((f) => !f.incluir);
    desenharScanShell();
  }
}

function rowScan(f) {
  return `<tr>
    <td class="tm-check"><input type="checkbox" data-incluir="${esc(f.caminho)}" ${f.incluir ? "checked" : ""} /></td>
    <td class="tm-path">${esc(f.caminho)}</td>
    <td><input type="text" class="input" data-conteudo="${esc(f.caminho)}" value="${esc(f.conteudo)}" placeholder="Ex.: Diárias D01 a D22" /></td>
  </tr>`;
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
