/* Equipe — acompanha o que cada responsável está fazendo, por
   projeto. Substitui a aba Histórico: os registros continuam na
   mesma coleção (agora com um campo "responsavel", mesmo mecanismo
   de período/ação/observações) — só a navegação mudou, de uma lista
   cronológica única para guias por pessoa (nomes vêm de
   Configurações → Responsáveis). */

import { store } from "../data/store.js";
import { esc } from "../ui/dom.js";
import { abrirNovoHistorico } from "./cadastros.js";
import { usuarioAtual } from "../data/auth.js";

export async function renderEquipe(app) {
  const [listas, historico, observacoes] = await Promise.all([
    store.getListas(), store.listHistorico(), store.getEquipeObservacoes(),
  ]);
  const podeEditar = !!usuarioAtual();
  const nomes = listas.responsaveis || [];
  let ativo = nomes[0] || "";

  app.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Equipe</h1>
        <div class="page-sub">O que cada responsável está fazendo, por projeto</div>
      </div>
    </div>
    ${nomes.length ? `<div class="filter-row" id="equipe-guias">
      ${nomes.map((n) => `<button class="chip${n === ativo ? " active" : ""}" data-nome="${esc(n)}">${esc(n)}</button>`).join("")}
    </div>` : ""}
    <div id="equipe-corpo"></div>
  `;

  const corpo = app.querySelector("#equipe-corpo");

  if (!nomes.length) {
    corpo.innerHTML = `<div class="empty">Nenhum responsável cadastrado ainda. Adicione em Configurações → Responsáveis.</div>`;
    return;
  }

  function desenhar() {
    const arr = historico.filter((h) => h.responsavel === ativo);
    corpo.innerHTML = `
      <div class="field" style="margin-top:16px">
        <label for="equipe-obs">Observações</label>
        <textarea id="equipe-obs" rows="3" placeholder="Notas gerais sobre ${esc(ativo)}…" ${podeEditar ? "" : "readonly"}>${esc(observacoes[ativo] || "")}</textarea>
      </div>
      <div class="toolbar edit-only" style="margin-bottom:16px">
        <button class="btn btn-primary" data-act="novo">+ Adicionar projeto</button>
      </div>
      <div class="list-card" id="lista-equipe">
        ${arr.length ? arr.map(row).join("") : `<div class="empty">${esc(ativo)} ainda não tem nada registrado.</div>`}
      </div>
    `;

    corpo.querySelector("#equipe-obs").addEventListener("change", async (e) => {
      observacoes[ativo] = e.target.value;
      await store.setEquipeObservacao(ativo, e.target.value);
    });

    const porId = Object.fromEntries(arr.map((h) => [h.id, h]));
    corpo.querySelector('[data-act="novo"]').addEventListener("click", () => abrirNovoHistorico({ responsavelFixo: ativo }));
    corpo.querySelector("#lista-equipe").addEventListener("click", async (e) => {
      const ed = e.target.closest("[data-edit]");
      const del = e.target.closest("[data-del]");
      if (ed) return abrirNovoHistorico({ responsavelFixo: ativo }, porId[ed.dataset.id]);
      if (del) {
        const h = porId[del.dataset.id];
        if (!confirm(`Excluir este registro (${h.periodo} · ${h.acao})?`)) return;
        await store.removeHistorico(h.id);
        window.dispatchEvent(new CustomEvent("data-changed"));
      }
    });
  }
  desenhar();

  app.querySelector("#equipe-guias").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-nome]");
    if (!btn) return;
    ativo = btn.dataset.nome;
    app.querySelectorAll("#equipe-guias .chip").forEach((c) => c.classList.toggle("active", c === btn));
    desenhar();
  });
}

function row(h) {
  return `<div class="list-row" data-id="${esc(h.id)}">
    <div class="lr-main">
      <div class="lr-title">${esc(h.projetoNome)} <span class="muted" style="font-weight:400">· ${esc(h.periodo)}</span></div>
      <div class="lr-sub">${esc(h.acao)}${h.observacoes ? " · " + esc(h.observacoes) : ""}</div>
    </div>
    <span class="lr-actions edit-only">
      <button class="icon-btn" data-edit data-id="${esc(h.id)}" title="Editar"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
      <button class="icon-btn danger" data-del data-id="${esc(h.id)}" title="Excluir"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
    </span>
  </div>`;
}
