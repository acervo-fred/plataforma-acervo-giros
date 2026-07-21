/* Teste Mídias — aba experimental pra testar o cadastro automático de
   pastas. Usa o seletor de pastas em árvore (js/ui/pasta-tree.js) e
   guarda o resultado numa coleção própria (acervo_testeMidias) —
   nunca toca em Mídias nem em Estrutura, pra poder validar a ideia
   sem risco. */

import { store } from "../data/store.js";
import { esc } from "../ui/dom.js";
import { montarSeletorPastas } from "../ui/pasta-tree.js";

export async function renderTesteMidias(app) {
  const salvas = await store.listTesteMidias();

  app.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Teste Mídias</h1>
        <div class="page-sub">Área experimental para testar o cadastro automático de pastas — não afeta Mídias nem Estrutura.</div>
      </div>
    </div>

    <div id="area-scan"></div>

    <div class="section-head"><h2>Pastas já salvas neste teste</h2></div>
    <div class="list-card" id="lista-salvas"></div>
  `;

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

  montarSeletorPastas(app.querySelector("#area-scan"), {
    onSalvar: async (marcados, raizAtual) => {
      const novas = await store.addTesteMidiasLote(
        marcados.map((no) => ({ caminho: no.caminho, conteudo: no.conteudo, origem: raizAtual }))
      );
      salvas.push(...novas);
      desenharSalvas();
    },
  });
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
