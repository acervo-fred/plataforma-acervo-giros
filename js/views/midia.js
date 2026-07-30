/* Detalhe da Mídia — dados da mídia, aviso de "mistura" (mais de um
   projeto dentro), lista clicável de Projetos armazenados (cada um na
   cor do próprio status), e o campo Conteúdo (observações). */

import { store } from "../data/store.js";
import { esc, formatAno } from "../ui/dom.js";
import { badgeFromLista, corDoValor } from "../ui/badges.js";
import { abrirNovaMidia, abrirNovaEstrutura } from "./cadastros.js";

const CORVAR = {
  gray: "--c-gray-fg", blue: "--c-blue-fg", amber: "--c-amber-fg",
  green: "--c-green-fg", violet: "--c-violet-fg", rose: "--c-rose-fg",
  teal: "--c-teal-fg", slate: "--c-slate-fg",
};

export async function renderMidia(app, id) {
  const midia = await store.getMidia(id);
  if (!midia) {
    app.innerHTML = `<a class="back-link" href="#/midias">← Voltar para mídias</a>
      <div class="empty">Mídia não encontrada.</div>`;
    return;
  }

  const [listas, projetos, estrutura] = await Promise.all([
    store.getListas(),
    store.projetosDaMidia(id),
    store.estruturaDaMidia(id),
  ]);

  const mistura = projetos.length > 1;

  app.innerHTML = `
    <a class="back-link" href="#/midias">← Voltar para mídias</a>

    <div class="detail-head">
      <div>
        <h1 class="page-title">${esc(midia.nome)}</h1>
        <div class="page-sub">${esc(midia.tipo)} · ${esc(midia.capacidade || "—")}</div>
      </div>
      <div class="row-end">
        ${badgeFromLista(listas.statusMidia, midia.statusMidia)}
        <button class="btn edit-only" data-act="editar">Editar</button>
        <button class="btn btn-ghost edit-only" data-act="excluir" title="Excluir mídia"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
      </div>
    </div>

    <div class="meta-grid">
      ${metaCell("Tipo", esc(midia.tipo))}
      ${metaCell("Capacidade", esc(midia.capacidade || "—"))}
      ${metaCell("Status", badgeFromLista(listas.statusMidia, midia.statusMidia))}
      ${metaCell("Onde está", esc(midia.local || "—"))}
      ${metaCell("Projetos dentro", String(projetos.length))}
    </div>

    ${mistura ? `<div class="warn">⚠ Esta mídia contém ${projetos.length} projetos diferentes.</div>` : ""}

    <!-- ESTRUTURA (pastas desta mídia) -->
    <section class="section">
      <div class="section-head"><h2>Estrutura das Pastas e Arquivos</h2>
        <div class="row-end edit-only">
          <a class="btn btn-primary" href="#/midia-pastas/${esc(midia.id)}">Importar caminho</a>
          <button class="btn btn-ghost" data-act="nova-pasta">+ Nova pasta</button>
        </div>
      </div>
      <div class="list-card" id="estrutura">
        ${estrutura.length ? estrutura.map((e) => estruturaRowMidia(e)).join("")
          : `<div class="empty">Nenhuma pasta registrada nesta mídia.</div>`}
      </div>
    </section>

    <!-- PROJETOS ARMAZENADOS (com conteúdo por projeto) -->
    <section class="section">
      <div class="section-head"><h2>Projetos armazenados</h2></div>
      <div class="note"><span class="note-i">ⓘ</span>
        Cada projeto aparece na cor do seu próprio status. O conteúdo é específico por projeto.</div>
      <div class="list-card" id="projetos">
        ${projetos.length ? projetos.map((p) => projetoRow(p, listas)).join("")
          : `<div class="empty">Nenhum projeto vinculado a esta mídia.</div>`}
      </div>
    </section>${midia.conteudo ? `
    <section class="section">
      <div class="section-head"><h2>Observações</h2></div>
      <div class="list-card"><div class="list-row"><div class="lr-main">
        <div class="lr-sub" style="font-size:14px">${esc(midia.conteudo)}</div>
      </div></div></div>
    </section>` : ""}
  `;

  app.querySelector("#projetos").addEventListener("click", (e) => {
    const row = e.target.closest("[data-projeto]");
    if (row && row.dataset.projeto) location.hash = `#/projeto/${row.dataset.projeto}`;
  });

  const acoes = {
    "editar": () => abrirNovaMidia(midia),
    "excluir": async () => {
      if (!confirm(`Excluir a mídia "${midia.nome}"?\n\nOs projetos não são apagados — só o registro desta mídia. Não dá para desfazer.`)) return;
      await store.removeMidia(midia.id);
      location.hash = "#/midias";
    },
    "nova-pasta": () => abrirNovaEstrutura({ midiaIdFixo: midia.id }),
  };
  app.querySelectorAll("[data-act]").forEach((btn) =>
    btn.addEventListener("click", () => acoes[btn.dataset.act]?.())
  );

  // editar/excluir pastas da estrutura
  const estPorId = Object.fromEntries(estrutura.map((e) => [e.id, e]));
  app.querySelector("#estrutura").addEventListener("click", async (ev) => {
    const edBtn = ev.target.closest("[data-edit-e]");
    const delBtn = ev.target.closest("[data-del-e]");
    if (edBtn) {
      const rec = estPorId[edBtn.dataset.id];
      if (rec) abrirNovaEstrutura({ midiaIdFixo: midia.id }, rec);
    } else if (delBtn) {
      const rec = estPorId[delBtn.dataset.id];
      if (!rec || !confirm(`Excluir a pasta "${rec.caminho}"?`)) return;
      await store.removeEstrutura(rec.id);
      window.dispatchEvent(new CustomEvent("data-changed"));
    }
  });
}

function metaCell(label, valueHtml) {
  return `<div class="meta-cell">
    <div class="meta-label">${label}</div>
    <div class="meta-value">${valueHtml}</div>
  </div>`;
}

function estruturaRowMidia(e) {
  return `<div class="list-row">
    <div class="lr-main">
      <div class="lr-title">${esc(e.caminho)} <span class="muted" style="font-weight:400">· ${esc(e.tipoMaterial)}</span></div>
      <div class="lr-sub"><a href="#/projeto/${esc(e.projetoId)}" style="color:var(--accent)">${esc(e.projetoNome)}</a>${e.resumo ? " · " + esc(e.resumo) : ""}</div>
    </div>
    ${e.arquivadoLto ? `<span class="tag">${esc(e.arquivadoLto)}</span>` : ""}
    <span class="lr-actions edit-only">
      <button class="icon-btn" data-edit-e data-id="${esc(e.id)}" title="Editar"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
      <button class="icon-btn danger" data-del-e data-id="${esc(e.id)}" title="Excluir"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
    </span>
  </div>`;
}

function projetoRow(p, listas) {
  if (!p.existe) {
    return `<div class="list-row">
      <div class="lr-main"><div class="lr-title muted">${esc(p.nome)}</div>
        <div class="lr-sub">ID ${esc(p.id)} não encontrado</div></div>
    </div>`;
  }
  const cor = corDoValor(listas.statusProjeto, p.statusProjeto);
  const corvar = CORVAR[cor] || "--border-strong";
  return `<div class="list-row clickable" data-projeto="${esc(p.id)}"
      style="border-left:4px solid var(${corvar})">
    <div class="lr-main">
      <div class="lr-title">${esc(p.nome)} <span class="muted" style="font-weight:400">· ${esc(formatAno(p.ano))}</span></div>
      ${p.conteudo ? `<div class="lr-sub">${esc(p.conteudo)}</div>` : ""}
    </div>
    ${badgeFromLista(listas.statusProjeto, p.statusProjeto)}
    <span class="muted">›</span>
  </div>`;
}
