/* Detalhe do Projeto — banner com nome/formato/status, linha de KPIs,
   e duas colunas: Mídias vinculadas + Links do projeto (principal) e
   Histórico + Demandas abertas (lateral). Fitas fica abaixo, inteira.
   Inclui editar/excluir do projeto e de cada item das listas. */

import { store } from "../data/store.js";
import { esc, formatAno, ordenarDemandas, compararNomes } from "../ui/dom.js";
import { badgeFromLista } from "../ui/badges.js";
import { fmtTB, somaUsado } from "../ui/formato.js";
import { iconeMidia } from "../ui/icons.js";
import { openModal, fieldText, fieldSelect, readValue } from "../ui/modal.js";
import { abrirNovoProjeto, abrirNovaMidia, abrirNovoHistorico, abrirNovaDemanda } from "./cadastros.js";
import { hashVoltar } from "../ui/nav-history.js";
import { pctProjeto, progressoHtml } from "./protocolo.js";

const TIPOS_LINK = ["Vimeo", "YouTube", "Site", "Drive", "Instagram", "Outro"];
const STATUS_FECHADOS = ["Concluída", "Cancelada"];

export async function renderProjeto(app, id) {
  const projeto = await store.getProjeto(id);
  if (!projeto) {
    app.innerHTML = `<a class="back-link" href="${esc(hashVoltar("#/"))}">← Voltar</a>
      <div class="empty">Projeto não encontrado.</div>`;
    return;
  }

  const [listas, midias, historico, demandasBrutas, fitas] = await Promise.all([
    store.getListas(),
    store.midiasDoProjeto(id),
    store.historicoDoProjeto(id),
    store.demandasDoProjeto(id),
    store.fitasDoProjeto(id),
  ]);
  const demandas = ordenarDemandas(demandasBrutas, listas.prioridade);
  const abertas = demandas.filter((d) => !STATUS_FECHADOS.includes(d.status));
  const fechadas = demandas.filter((d) => STATUS_FECHADOS.includes(d.status));

  const totalUsado = somaUsado(midias);
  const ltoUsado = somaUsado(midias.filter((m) => m.tipo === "LTO"));
  const links = projeto.linksExternos || [];

  app.innerHTML = `
    <a class="back-link" href="${esc(hashVoltar("#/"))}">← Voltar</a>

    <div class="proj-banner"${projeto.capa
      ? ` style="background-image: linear-gradient(120deg, rgba(9,26,20,.78), rgba(20,70,52,.55)), url('${esc(projeto.capa)}')"`
      : ""}>
      <span class="proj-banner-badge">${badgeFromLista(listas.statusProjeto, projeto.statusProjeto)}</span>
      <h1 class="proj-banner-title">${esc(projeto.nome)}</h1>
      <div class="proj-banner-sub">${esc(subtituloProjeto(projeto))}</div>
    </div>

    <div class="proj-toolbar">
      <a class="btn btn-ghost" href="#/protocolo/${esc(projeto.id)}">Protocolo de arquivamento</a>
      <div class="row-end edit-only">
        <button class="btn" data-act="editar">Editar</button>
        <button class="btn btn-ghost" data-act="excluir" title="Excluir projeto"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-row">
      ${kpi("Status atual", badgeFromLista(listas.statusProjeto, projeto.statusProjeto), "", true)}
      ${kpi("Mídias vinculadas", String(midias.length), midias.length === 1 ? "mídia no acervo" : "mídias no acervo")}
      ${kpi("Tamanho total", fmtTB(totalUsado), ltoUsado ? `${fmtTB(ltoUsado)} em LTO` : "espaço ocupado nas mídias")}
      ${kpiProtocolo(projeto)}
    </div>

    <div class="proj-cols">
      <!-- COLUNA PRINCIPAL -->
      <div class="proj-col-main">
        <section class="section">
          <div class="section-head"><h2>Mídias vinculadas</h2>
            <button class="btn btn-ghost edit-only" data-act="nova-midia">+ Nova mídia</button></div>
          <div class="list-card" id="midias">
            ${midias.length ? [...midias].sort((a, b) => compararNomes(a.nome, b.nome)).map((m) => midiaRow(m, listas)).join("")
              : `<div class="empty">Nenhuma mídia contém este projeto.</div>`}
          </div>
        </section>

        <section class="section">
          <div class="section-head"><h2>Links do projeto</h2>
            <button class="btn btn-ghost edit-only" data-act="novo-link">+ Adicionar link</button></div>
          <div class="list-card" id="links">
            ${links.length ? links.map((l, i) => linkRow(l, i)).join("")
              : `<div class="empty">Nenhum link cadastrado.</div>`}
          </div>
        </section>
      </div>

      <!-- COLUNA LATERAL -->
      <div class="proj-col-side">
        <section class="section">
          <div class="section-head"><h2>Histórico</h2>
            <button class="btn btn-ghost edit-only" data-act="novo-historico">+ Novo</button></div>
          <div class="list-card timeline-card">
            ${historico.length
              ? `<div class="timeline">${historico.map((h, i) => historicoItem(h, i === 0)).join("")}</div>`
              : `<div class="empty">Sem histórico.</div>`}
          </div>
        </section>

        <section class="section">
          <div class="section-head"><h2>Demandas abertas</h2>
            <button class="btn btn-ghost edit-only" data-act="nova-demanda">+ Nova</button></div>
          <div class="list-card">
            ${abertas.length ? abertas.map((d) => demandaRow(d, listas)).join("")
              : `<div class="empty">Nenhuma demanda aberta.</div>`}
            ${fechadas.length ? `
              <button class="lc-toggle" type="button" id="ver-concluidas">Mostrar ${fechadas.length} concluída${fechadas.length > 1 ? "s" : ""}</button>
              <div id="demandas-fechadas" hidden>${fechadas.map((d) => demandaRow(d, listas)).join("")}</div>
            ` : ""}
          </div>
        </section>
      </div>
    </div>

    <!-- FITAS -->
    <section class="section">
      <div class="section-head"><h2>Fitas <span class="section-hint">fitas vinculadas a este projeto</span></h2></div>
      <div class="list-card">
        ${fitas.length ? fitas.map((f) => fitaRow(f, listas)).join("")
          : `<div class="empty">Nenhuma fita vinculada a este projeto.</div>`}
      </div>
    </section>
  `;

  // navegação para detalhe de mídia (ignora cliques nos botões de ação)
  app.querySelector("#midias").addEventListener("click", (e) => {
    if (e.target.closest("[data-row-act]")) return;
    const row = e.target.closest("[data-midia]");
    if (row) location.hash = `#/midia/${row.dataset.midia}`;
  });

  // ações do projeto (cabeçalho) e de adicionar itens
  const acoes = {
    "editar": () => abrirNovoProjeto(projeto),
    "excluir": async () => {
      if (!confirm(`Excluir o projeto "${projeto.nome}"?\n\nIsto remove também a estrutura, o histórico e as pendências deste projeto, e tira o projeto das mídias. Não dá para desfazer.`)) return;
      await store.removeProjeto(projeto.id);
      location.hash = "#/";
    },
    "nova-midia": () => abrirNovaMidia(null, { projetoIdFixo: projeto.id }),
    "novo-historico": () => abrirNovoHistorico({ projetoIdFixo: projeto.id }),
    "nova-demanda": () => abrirNovaDemanda(projeto.id),
    "novo-link": () => abrirLink(projeto, links),
  };
  app.querySelectorAll("[data-act]").forEach((btn) =>
    btn.addEventListener("click", () => acoes[btn.dataset.act]?.(btn))
  );

  // "mostrar concluídas" (demandas)
  const btnVerConcluidas = app.querySelector("#ver-concluidas");
  if (btnVerConcluidas) {
    btnVerConcluidas.addEventListener("click", () => {
      const box = app.querySelector("#demandas-fechadas");
      box.hidden = !box.hidden;
      btnVerConcluidas.textContent = box.hidden
        ? `Mostrar ${fechadas.length} concluída${fechadas.length > 1 ? "s" : ""}`
        : "Ocultar concluídas";
    });
  }

  // editar/excluir links (índice no array, gravado inteiro)
  app.querySelector("#links").addEventListener("click", async (e) => {
    const ed = e.target.closest("[data-edit-link]");
    const del = e.target.closest("[data-del-link]");
    if (ed) return abrirLink(projeto, links, Number(ed.dataset.i));
    if (del) {
      const i = Number(del.dataset.i);
      if (!confirm(`Remover o link "${links[i].label || links[i].url}"?`)) return;
      const novos = links.filter((_, idx) => idx !== i);
      await store.updateProjeto(projeto.id, { linksExternos: novos });
      window.dispatchEvent(new CustomEvent("data-changed"));
    }
  });

  // editar/excluir itens das listas
  ligaItens(app, "h", historico,
    (rec) => abrirNovoHistorico({ projetoIdFixo: projeto.id }, rec),
    (rec) => [`Excluir este registro de histórico (${rec.periodo})?`, () => store.removeHistorico(rec.id)]);
  ligaItens(app, "d", demandas,
    (rec) => abrirNovaDemanda(projeto.id, rec),
    (rec) => [`Excluir a pendência "${rec.pendencia}"?`, () => store.removeDemanda(rec.id)]);
}

// "Série (2 temporadas · 16 episódios) · 2024" / "Longa-metragem · 2024"
function subtituloProjeto(p) {
  const formato = p.formato || "Longa-metragem";
  const bits = [];
  if (formato === "Série") {
    if (p.temporadas) bits.push(`${p.temporadas} temporada${p.temporadas > 1 ? "s" : ""}`);
    if (p.episodios) bits.push(`${p.episodios} episódio${p.episodios > 1 ? "s" : ""}`);
  }
  const rotulo = bits.length ? `${formato} (${bits.join(" · ")})` : formato;
  return `${rotulo} · ${formatAno(p.ano)}`;
}

/* ---------------- Links externos (criar / editar) ---------------- */
function abrirLink(projeto, links, indice = null) {
  const ed = indice !== null;
  const l = ed ? links[indice] : {};
  openModal({
    title: ed ? "Editar link" : "Adicionar link",
    subtitle: projeto.nome,
    submitLabel: ed ? "Salvar" : "Adicionar",
    bodyHtml: `
      ${fieldSelect("tipo", "Tipo", TIPOS_LINK, { value: l.tipo || TIPOS_LINK[0] })}
      ${fieldText("url", "URL", { required: true, value: l.url || "", placeholder: "https://vimeo.com/…" })}
      ${fieldText("label", "Rótulo", { value: l.label || "", hint: "Opcional — como o link aparece na lista. Em branco, usa o tipo." })}
    `,
    onSubmit: async (form) => {
      const url = readValue(form, "url");
      if (!url) throw new Error("Informe a URL do link.");
      if (!/^https?:\/\//i.test(url)) throw new Error("A URL precisa começar com http:// ou https://");
      const item = { tipo: readValue(form, "tipo"), url, label: readValue(form, "label") };
      const novos = ed
        ? links.map((x, i) => (i === indice ? item : x))
        : [...links, item];
      await store.updateProjeto(projeto.id, { linksExternos: novos });
      window.dispatchEvent(new CustomEvent("data-changed"));
    },
  });
}

/* liga os botões ✎/🗑 de uma lista. tipo: "e" | "h" | "d" */
function ligaItens(app, tipo, registros, onEdit, onDel) {
  const porId = Object.fromEntries(registros.map((r) => [r.id, r]));
  app.querySelectorAll(`[data-edit="${tipo}"]`).forEach((b) =>
    b.addEventListener("click", () => onEdit(porId[b.dataset.id]))
  );
  app.querySelectorAll(`[data-del="${tipo}"]`).forEach((b) =>
    b.addEventListener("click", async () => {
      const [msg, acao] = onDel(porId[b.dataset.id]);
      if (!confirm(msg)) return;
      await acao();
      window.dispatchEvent(new CustomEvent("data-changed"));
    })
  );
}

function acoesRow(tipo, id) {
  return `<span class="lr-actions edit-only">
    <button class="icon-btn" data-row-act data-edit="${tipo}" data-id="${esc(id)}" title="Editar"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
    <button class="icon-btn danger" data-row-act data-del="${tipo}" data-id="${esc(id)}" title="Excluir"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
  </span>`;
}

function kpi(label, valor, sub = "", valorHtml = false) {
  return `<div class="kpi">
    <div class="kpi-label">${esc(label)}</div>
    <div class="kpi-valor${valorHtml ? " kpi-valor--html" : ""}">${valorHtml ? valor : esc(valor)}</div>
    ${sub ? `<div class="kpi-sub">${esc(sub)}</div>` : ""}
  </div>`;
}

// donut + rótulo iguais aos da lista da aba Arquivamento (pctProjeto/
// progressoHtml, em protocolo.js) — clicável, abre o protocolo do projeto
function kpiProtocolo(projeto) {
  return `<a class="kpi kpi--link" href="#/protocolo/${esc(projeto.id)}">
    <div class="kpi-label">Arquivamento</div>
    <div class="kpi-valor kpi-valor--html">${progressoHtml(pctProjeto(projeto))}</div>
    <div class="kpi-sub">ver protocolo de arquivamento →</div>
  </a>`;
}

// linha de mídia vinculada (lista, não mais grade de ícones)
function midiaRow(m, listas) {
  return `<div class="list-row clickable" data-midia="${esc(m.id)}">
    <span class="midia-row-ic"><img src="${esc(iconeMidia(m.tipo, listas))}" alt="" loading="lazy"></span>
    <div class="lr-main">
      <div class="lr-title">${esc(m.nome)}</div>
      <div class="lr-sub">${esc(m.tipo)} · ${esc(m.local || "sem local")} · ${esc(m.capacidade || "—")}</div>
    </div>
    ${badgeFromLista(listas.statusMidia, m.statusMidia)}
  </div>`;
}

function linkRow(l, i) {
  const rotulo = l.label || l.tipo || "Link";
  return `<div class="list-row">
    <span class="link-ic"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></span>
    <div class="lr-main">
      <div class="lr-title"><a href="${esc(l.url)}" target="_blank" rel="noopener" class="link-a">${esc(rotulo)}</a></div>
      <div class="lr-sub link-url">${esc(l.url)}</div>
    </div>
    ${l.tipo ? `<span class="tag">${esc(l.tipo)}</span>` : ""}
    <span class="lr-actions edit-only">
      <button class="icon-btn" data-edit-link data-i="${i}" title="Editar"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
      <button class="icon-btn danger" data-del-link data-i="${i}" title="Remover"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
    </span>
  </div>`;
}

// item da timeline de histórico — o mais recente ganha o marcador em destaque
function historicoItem(h, atual) {
  return `<div class="timeline-item">
    <span class="timeline-dot${atual ? " timeline-dot--atual" : ""}"></span>
    <div class="timeline-row">
      <div class="timeline-title">${esc(h.acao)}</div>
      ${acoesRow("h", h.id)}
    </div>
    <div class="timeline-meta">${esc(h.periodo)}${h.responsavel ? ` · ${esc(h.responsavel)}` : ""}</div>
    ${h.observacoes ? `<div class="timeline-desc">${esc(h.observacoes)}</div>` : ""}
  </div>`;
}

function demandaRow(d, listas) {
  const feita = d.status === "Concluída";
  return `<div class="list-row${feita ? " list-row--done" : ""}">
    <div class="lr-main">
      <div class="lr-title">${feita ? `<span class="done-check" title="Concluída"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>` : ""}${esc(d.pendencia)}</div>
      <div class="lr-sub">${esc(d.responsavel || "—")}</div>
    </div>
    ${badgeFromLista(listas.prioridade, d.prioridade)}
    ${badgeFromLista(listas.statusDemanda, d.status)}
    ${acoesRow("d", d.id)}
  </div>`;
}

function fitaRow(f, listas) {
  return `<div class="list-row">
    <div class="lr-main">
      <div class="lr-title">📼 ${esc(f.codigo)} <span class="muted" style="font-weight:400">· ${esc(f.tipo)}</span></div>
      <div class="lr-sub">${esc(f.localFisico || "")}${f.observacoes ? ` · ${esc(f.observacoes)}` : ""}</div>
    </div>
    ${badgeFromLista(listas.statusFita || [], f.statusFita)}
  </div>`;
}
