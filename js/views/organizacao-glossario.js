/* Glossário — termos herdados do "Avaliação do Acervo", com
   possibilidade de adicionar novos (compartilhado via Firestore). */

import { store } from "../data/store.js";
import { esc } from "../ui/dom.js";
import { openModal, fieldText, fieldTextarea, readValue } from "../ui/modal.js";

export async function renderGlossario(cont) {
  const termos = await store.listGlossario();

  cont.innerHTML = `
    <div class="toolbar" style="margin-bottom:16px">
      <button class="btn btn-primary" id="btn-novo-termo">+ Novo termo</button>
    </div>
    <div class="glossario-grid" id="glossario-grid"></div>
  `;

  const grid = cont.querySelector("#glossario-grid");
  const porId = Object.fromEntries(termos.map((t) => [t.id, t]));

  function desenhar(lista) {
    grid.innerHTML = lista.length
      ? lista.map((t) => `
        <div class="glossario-item">
          <div class="gi-head">
            <span class="gi-termo">${esc(t.termo)}</span>
            <button class="icon-btn danger" data-del="${esc(t.id)}" title="Remover">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
          <div class="gi-desc">${esc(t.descricao)}</div>
        </div>`).join("")
      : `<div class="empty">Nenhum termo cadastrado ainda.</div>`;
  }
  desenhar(termos);

  cont.querySelector("#btn-novo-termo").addEventListener("click", () => {
    openModal({
      title: "Novo termo do glossário",
      submitLabel: "Adicionar",
      bodyHtml: `
        ${fieldText("termo", "Termo", { required: true, placeholder: "Ex.: Transcodificação" })}
        ${fieldTextarea("descricao", "Descrição", { hint: "Explicação curta, em linguagem simples." })}
      `,
      onSubmit: async (form) => {
        const termo = readValue(form, "termo");
        if (!termo) throw new Error("Informe o termo.");
        const novo = await store.addGlossarioTermo(termo, readValue(form, "descricao"));
        termos.push(novo);
        porId[novo.id] = novo;
        desenhar(termos);
      },
    });
  });

  grid.addEventListener("click", async (e) => {
    const del = e.target.closest("[data-del]");
    if (!del) return;
    const t = porId[del.dataset.del];
    if (!confirm(`Remover o termo "${t.termo}"?`)) return;
    await store.removeGlossarioTermo(t.id);
    const i = termos.findIndex((x) => x.id === t.id);
    if (i !== -1) termos.splice(i, 1);
    desenhar(termos);
  });
}
