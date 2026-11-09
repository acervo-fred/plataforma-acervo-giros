/* Partes de um projeto: TEMPORADAS e VERSÕES.

   A obra continua sendo UM projeto só (na home, na sidebar, nas mídias).
   Dentro da página do projeto aparecem abas: "Visão geral" + uma aba por
   parte (rota #/projeto/:id/:parteId) + "+ Adicionar".
     - Temporada: "1ª temporada", "2ª temporada"… (numeradas)
     - Versão: nome livre ("Longa", "Série", "Corte para TV"…), com
       formato e duração próprios — ex.: A Revolta dos Malês tem uma
       versão longa e uma versão série.

   Dados: projeto.partes = [{ id, tipo: "Temporada"|"Versão", n, nome,
   formato, duracao, ano, episodios, statusProjeto, observacoes,
   links: [{tipo,url,label}] }]. O número projeto.temporadas fica
   sincronizado com a quantidade de temporadas.
   O `id` de uma parte é estável (não muda se a temporada for renumerada),
   porque as mídias apontam pra ele: midia.partesPorProjeto =
   { [projetoId]: [parteId, …] } — vazio/ausente = mídia da obra toda.
   Compatibilidade: sem `partes`, usa `temporadasLista` (versão anterior
   desta tela) ou, por último, cria temporadas vazias a partir do número
   `temporadas` — a lista de verdade é gravada na primeira edição. */

import { store } from "../data/store.js";
import { esc, formatAno } from "../ui/dom.js";
import { badgeFromLista } from "../ui/badges.js";
import { openModal, fieldText, fieldTextarea, fieldSelect, readValue } from "../ui/modal.js";

const TIPOS_LINK = ["Vimeo", "YouTube", "Site", "Drive", "Instagram", "Outro"];
export const TIPOS_PARTE = ["Temporada", "Versão"];
export const FORMATOS_VERSAO = ["Longa-metragem", "Média-metragem", "Curta-metragem", "Série", "Corte para TV", "Versão internacional", "Outro"];

const ICON_EDIT = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`;
const ICON_DEL = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;
const ICON_LINK = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;

export function ehSerie(p) { return (p.formato || "") === "Série"; }

function novoIdParte() { return "pt_" + Math.random().toString(36).slice(2, 9); }

export function temporadaVazia(n) {
  return { id: `t${n}`, tipo: "Temporada", n, nome: "", formato: "", duracao: "",
    ano: null, episodios: null, statusProjeto: "", observacoes: "", links: [] };
}
export function versaoVazia(nome = "") {
  return { id: novoIdParte(), tipo: "Versão", n: null, nome, formato: "", duracao: "",
    ano: null, episodios: null, statusProjeto: "", observacoes: "", links: [] };
}

// lista normalizada (sempre cópia nova): versões na ordem gravada,
// depois temporadas por número
export function listaPartes(p) {
  let lista;
  if (Array.isArray(p.partes)) lista = p.partes;
  else if (Array.isArray(p.temporadasLista) && p.temporadasLista.length) {
    lista = p.temporadasLista.map((t) => ({ ...temporadaVazia(t.n), ...t, tipo: "Temporada", id: `t${t.n}` }));
  } else {
    lista = Array.from({ length: Number(p.temporadas) || 0 }, (_, i) => temporadaVazia(i + 1));
  }
  const copia = lista.map((x) => ({ ...x, links: [...(x.links || [])] }));
  return [
    ...copia.filter((x) => x.tipo !== "Temporada"),
    ...copia.filter((x) => x.tipo === "Temporada").sort((a, b) => a.n - b.n),
  ];
}

export function contarPartes(p) {
  const l = listaPartes(p);
  return { temporadas: l.filter((x) => x.tipo === "Temporada").length, versoes: l.filter((x) => x.tipo !== "Temporada").length };
}

export function temAbas(p) { return ehSerie(p) || listaPartes(p).length > 0; }

export function rotuloParte(x) {
  return x.tipo === "Temporada" ? `${x.n}ª temporada` : (x.nome || "Versão");
}

async function gravar(projeto, lista) {
  const temporadas = lista.filter((x) => x.tipo === "Temporada").length;
  await store.updateProjeto(projeto.id, { partes: lista, temporadas: temporadas || null });
  window.dispatchEvent(new CustomEvent("data-changed"));
}

/* ---------- abas ---------- */
export function abasPartesHtml(projeto, abaAtual) {
  const base = `#/projeto/${esc(projeto.id)}`;
  return `<div class="org-tabs temp-tabs">
    <a href="${base}" class="org-tab ${abaAtual == null ? "active" : ""}">Visão geral</a>
    ${listaPartes(projeto).map((x) => `<a href="${base}/${esc(x.id)}" class="org-tab ${abaAtual === x.id ? "active" : ""}">${esc(rotuloParte(x))}</a>`).join("")}
    <button type="button" class="org-tab temp-tab-add edit-only" data-temp-act="nova">+ Adicionar</button>
  </div>`;
}

// resumo mostrado na visão geral
export function resumoPartesHtml(projeto, listas) {
  const lista = listaPartes(projeto);
  const titulo = lista.length && lista.every((x) => x.tipo === "Temporada") ? "Temporadas"
    : lista.length && lista.every((x) => x.tipo !== "Temporada") ? "Versões" : "Temporadas e versões";
  if (!lista.length) {
    return `<section class="section">
      <div class="section-head"><h2>Temporadas e versões</h2></div>
      <div class="list-card"><div class="empty">Nada cadastrado ainda. Use “+ Adicionar” acima.</div></div>
    </section>`;
  }
  return `<section class="section">
    <div class="section-head"><h2>${titulo}</h2></div>
    <div class="list-card">
      ${lista.map((x) => `<a class="list-row clickable" href="#/projeto/${esc(projeto.id)}/${esc(x.id)}">
        <div class="lr-main">
          <div class="lr-title">${esc(rotuloParte(x))}</div>
          <div class="lr-sub">${esc(subParte(x))}</div>
        </div>
        ${x.tipo !== "Temporada" ? `<span class="tag">Versão</span>` : ""}
        ${x.statusProjeto ? badgeFromLista(listas.statusProjeto, x.statusProjeto) : ""}
      </a>`).join("")}
    </div>
  </section>`;
}

function subParte(x) {
  const bits = [];
  if (x.tipo !== "Temporada" && x.formato) bits.push(x.formato);
  bits.push(x.ano ? formatAno(x.ano) : "ano não informado");
  if (x.duracao) bits.push(x.duracao);
  if (x.episodios) bits.push(`${x.episodios} episódio${x.episodios > 1 ? "s" : ""}`);
  if ((x.links || []).length) bits.push(`${x.links.length} link${x.links.length > 1 ? "s" : ""}`);
  return bits.join(" · ");
}

/* ---------- conteúdo de uma aba ---------- */
// ids das partes (deste projeto) a que uma mídia está ligada
export function partesDaMidia(m, projetoId) {
  return (m.partesPorProjeto || {})[projetoId] || [];
}

// etiquetas "1ª temporada" / "Longa" pra uma linha de mídia na visão geral
export function etiquetasPartesHtml(projeto, m) {
  const ids = partesDaMidia(m, projeto.id);
  if (!ids.length) return "";
  const porId = Object.fromEntries(listaPartes(projeto).map((x) => [x.id, x]));
  return ids.filter((i) => porId[i]).map((i) => `<span class="tag tag-parte">${esc(rotuloParte(porId[i]))}</span>`).join("");
}

export function painelParteHtml(projeto, parteId, listas, midias = [], midiaRowHtml = null) {
  const x = listaPartes(projeto).find((p) => p.id === parteId);
  if (!x) return `<div class="empty">Esta temporada/versão não existe mais.</div>`;
  const links = x.links || [];
  const versao = x.tipo !== "Temporada";
  const info = (rotulo, valorHtml) => `<div><div class="kpi-label">${rotulo}</div><div class="temp-info-val">${valorHtml}</div></div>`;
  return `
    <section class="section">
      <div class="section-head"><h2>${esc(rotuloParte(x))}${versao ? ` <span class="section-hint">versão</span>` : ""}</h2>
        <div class="row-end edit-only">
          <button class="btn btn-ghost" data-temp-act="editar">Editar ${versao ? "versão" : "temporada"}</button>
          <button class="btn btn-ghost" data-temp-act="excluir" title="Excluir">${ICON_DEL}</button>
        </div>
      </div>
      <div class="list-card temp-info">
        <div class="temp-info-grid">
          ${versao ? info("Formato", x.formato ? esc(x.formato) : "—") : ""}
          ${info("Ano", x.ano ? esc(formatAno(x.ano)) : "—")}
          ${versao ? info("Duração", x.duracao ? esc(x.duracao) : "—") : ""}
          ${info("Episódios", x.episodios ? esc(String(x.episodios)) : "—")}
          ${info("Status", x.statusProjeto ? badgeFromLista(listas.statusProjeto, x.statusProjeto) : "—")}
        </div>
        ${x.observacoes ? `<div class="temp-obs">${esc(x.observacoes)}</div>` : ""}
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Mídias ${versao ? "desta versão" : "desta temporada"}</h2>
        <button class="btn btn-ghost edit-only" data-temp-act="midias">Escolher mídias</button></div>
      <div class="list-card" id="midias">
        ${(() => {
          const daParte = midias.filter((m) => partesDaMidia(m, projeto.id).includes(x.id));
          if (daParte.length && midiaRowHtml) return daParte.map(midiaRowHtml).join("");
          return `<div class="empty">${midias.length
            ? `Nenhuma mídia marcada para ${versao ? "esta versão" : "esta temporada"}. Use “Escolher mídias”.`
            : "Este projeto ainda não tem mídias vinculadas."}</div>`;
        })()}
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Links ${versao ? "da versão" : "da temporada"}</h2>
        <button class="btn btn-ghost edit-only" data-temp-act="novo-link">+ Adicionar link</button></div>
      <div class="list-card" id="temp-links">
        ${links.length ? links.map((l, i) => linkRow(l, i)).join("") : `<div class="empty">Nenhum link cadastrado aqui.</div>`}
      </div>
    </section>
    <p class="section-hint temp-nota">Histórico, demandas e fitas ficam na aba “Visão geral”, valendo para a obra toda.</p>
  `;
}

function linkRow(l, i) {
  const rotulo = l.label || l.tipo || "Link";
  return `<div class="list-row">
    <span class="link-ic">${ICON_LINK}</span>
    <div class="lr-main">
      <div class="lr-title"><a href="${esc(l.url)}" target="_blank" rel="noopener" class="link-a">${esc(rotulo)}</a></div>
      <div class="lr-sub link-url">${esc(l.url)}</div>
    </div>
    ${l.tipo ? `<span class="tag">${esc(l.tipo)}</span>` : ""}
    <span class="lr-actions edit-only">
      <button class="icon-btn" data-temp-edit-link data-i="${i}" title="Editar">${ICON_EDIT}</button>
      <button class="icon-btn danger" data-temp-del-link data-i="${i}" title="Remover">${ICON_DEL}</button>
    </span>
  </div>`;
}

/* ---------- ações ---------- */
export function ligarPartes(app, projeto, parteId, listas) {
  const acoes = {
    "nova": () => abrirParte(projeto, listas, null),
    "editar": () => abrirParte(projeto, listas, parteId),
    "excluir": async () => {
      const lista = listaPartes(projeto);
      const x = lista.find((p) => p.id === parteId);
      if (!x) return;
      if (!confirm(`Excluir “${rotuloParte(x)}” de "${projeto.nome}"?\n\nAs informações e links desta ${x.tipo === "Temporada" ? "temporada" : "versão"} serão apagados. Não dá para desfazer.`)) return;
      let resto = lista.filter((p) => p.id !== parteId);
      // renumera temporadas pra não deixar buraco (T3 vira T2 etc.) — o id fica
      let k = 0;
      resto = resto.map((p) => (p.tipo === "Temporada" ? { ...p, n: ++k } : p));
      // tira a parte excluída das mídias que apontavam pra ela
      const midias = await store.midiasDoProjeto(projeto.id);
      await Promise.all(midias
        .filter((m) => partesDaMidia(m, projeto.id).includes(parteId))
        .map((m) => store.updateMidia(m.id, {
          partesPorProjeto: { ...(m.partesPorProjeto || {}), [projeto.id]: partesDaMidia(m, projeto.id).filter((i) => i !== parteId) },
        })));
      await gravar(projeto, resto);
      location.hash = `#/projeto/${projeto.id}`;
    },
    "novo-link": () => abrirLinkParte(projeto, parteId, null),
    "midias": () => abrirMidiasDaParte(projeto, parteId),
  };
  app.querySelectorAll("[data-temp-act]").forEach((b) =>
    b.addEventListener("click", () => acoes[b.dataset.tempAct]?.())
  );

  const boxLinks = app.querySelector("#temp-links");
  if (boxLinks) {
    boxLinks.addEventListener("click", async (e) => {
      const ed = e.target.closest("[data-temp-edit-link]");
      const del = e.target.closest("[data-temp-del-link]");
      if (ed) return abrirLinkParte(projeto, parteId, Number(ed.dataset.i));
      if (del) {
        const lista = listaPartes(projeto);
        const x = lista.find((p) => p.id === parteId);
        const i = Number(del.dataset.i);
        if (!confirm(`Remover o link "${x.links[i].label || x.links[i].url}"?`)) return;
        x.links = x.links.filter((_, idx) => idx !== i);
        await gravar(projeto, lista);
      }
    });
  }
}

/* criar (parteId = null) ou editar uma temporada/versão */
function abrirParte(projeto, listas, parteId) {
  const lista = listaPartes(projeto);
  const ed = parteId != null;
  const proxN = Math.max(0, ...lista.filter((p) => p.tipo === "Temporada").map((p) => p.n)) + 1;
  // nova: série sugere temporada; o resto sugere versão
  const x = ed ? lista.find((p) => p.id === parteId)
    : (ehSerie(projeto) ? temporadaVazia(proxN) : versaoVazia());
  const opcoesStatus = ["", ...listas.statusProjeto.map((o) => (typeof o === "string" ? o : o.valor))];
  const tipoInicial = x.tipo;
  openModal({
    title: ed ? `Editar ${rotuloParte(x)}` : "Adicionar temporada ou versão",
    subtitle: projeto.nome,
    submitLabel: ed ? "Salvar" : "Adicionar",
    bodyHtml: `
      ${ed ? "" : fieldSelect("tipo", "Tipo", TIPOS_PARTE, { value: tipoInicial })}
      <div data-so="Temporada" ${tipoInicial === "Temporada" ? "" : "hidden"}>
        ${fieldText("n", "Número da temporada", { type: "number", value: x.n || proxN })}
      </div>
      <div data-so="Versão" ${tipoInicial === "Versão" ? "" : "hidden"}>
        <div class="field-2col">
          ${fieldText("nome", "Nome da versão", { value: x.nome || "", placeholder: "Ex.: Longa, Série, Corte para TV" })}
          ${fieldSelect("formato", "Formato", ["", ...FORMATOS_VERSAO], { value: x.formato || "" })}
        </div>
        ${fieldText("duracao", "Duração", { value: x.duracao || "", placeholder: "Ex.: 90 min · 8 × 26 min" })}
      </div>
      <div class="field-2col">
        ${fieldText("ano", "Ano", { type: "number", value: x.ano || "", placeholder: "Deixe em branco se não souber" })}
        ${fieldText("episodios", "Episódios", { type: "number", value: x.episodios || "", placeholder: "Ex.: 8" })}
      </div>
      ${fieldSelect("statusProjeto", "Status", opcoesStatus, { value: x.statusProjeto || "" })}
      ${fieldTextarea("observacoes", "Observações", { value: x.observacoes || "" })}
    `,
    onMount: (form) => {
      const sel = form.elements.tipo;
      if (!sel) return;
      sel.addEventListener("change", () => {
        form.querySelectorAll("[data-so]").forEach((el) => { el.hidden = el.dataset.so !== sel.value; });
      });
    },
    onSubmit: async (form) => {
      const tipo = ed ? x.tipo : readValue(form, "tipo");
      const comuns = {
        ano: Number(readValue(form, "ano")) || null,
        episodios: Number(readValue(form, "episodios")) || null,
        statusProjeto: readValue(form, "statusProjeto") || "",
        observacoes: readValue(form, "observacoes") || "",
      };
      let item;
      if (tipo === "Temporada") {
        const n = Number(readValue(form, "n"));
        if (!Number.isInteger(n) || n < 1) throw new Error("Informe um número de temporada válido (1, 2, 3…).");
        if (lista.some((p) => p.tipo === "Temporada" && p.n === n && p.id !== x.id)) {
          throw new Error(`Já existe a ${n}ª temporada neste projeto.`);
        }
        item = { ...(ed ? x : { ...temporadaVazia(n), id: novoIdParte() }), ...comuns, tipo, n };
      } else {
        const nome = readValue(form, "nome");
        if (!nome) throw new Error("Dê um nome à versão (ex.: Longa, Série).");
        item = { ...(ed ? x : versaoVazia()), ...comuns, tipo, nome,
          formato: readValue(form, "formato") || "", duracao: readValue(form, "duracao") || "" };
      }
      const nova = ed ? lista.map((p) => (p.id === x.id ? item : p)) : [...lista, item];
      await gravar(projeto, nova);
      location.hash = `#/projeto/${projeto.id}/${item.id}`;
    },
  });
}

function abrirLinkParte(projeto, parteId, indice) {
  const lista = listaPartes(projeto);
  const x = lista.find((p) => p.id === parteId);
  const ed = indice != null;
  const l = ed ? x.links[indice] : {};
  openModal({
    title: ed ? "Editar link" : "Adicionar link",
    subtitle: `${projeto.nome} · ${rotuloParte(x)}`,
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
      x.links = ed ? x.links.map((v, i) => (i === indice ? item : v)) : [...x.links, item];
      await gravar(projeto, lista);
    },
  });
}

/* marca/desmarca quais mídias (já vinculadas ao projeto) são desta parte */
async function abrirMidiasDaParte(projeto, parteId) {
  const x = listaPartes(projeto).find((p) => p.id === parteId);
  const midias = (await store.midiasDoProjeto(projeto.id))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
  if (!midias.length) {
    openModal({ title: "Escolher mídias", subtitle: `${projeto.nome} · ${rotuloParte(x)}`, submitLabel: "Fechar",
      bodyHtml: `<div class="empty">Este projeto ainda não tem mídias. Vincule na aba “Visão geral” (+ Nova mídia) ou editando a mídia.</div>`,
      onSubmit: async () => {} });
    return;
  }
  openModal({
    title: "Escolher mídias",
    subtitle: `${projeto.nome} · ${rotuloParte(x)}`,
    submitLabel: "Salvar",
    bodyHtml: `
      <div class="field-hint" style="margin-bottom:8px">Marque as mídias que guardam material ${x.tipo === "Temporada" ? "desta temporada" : "desta versão"}. Uma mídia pode estar em mais de uma. Só aparecem as mídias já vinculadas a este projeto.</div>
      <div class="checklist">
        ${midias.map((m) => `<label><input type="checkbox" name="midia" value="${esc(m.id)}" ${partesDaMidia(m, projeto.id).includes(parteId) ? "checked" : ""}/> ${esc(m.nome)} <span class="muted">· ${esc(m.tipo || "")}</span></label>`).join("")}
      </div>
    `,
    onSubmit: async (form) => {
      const marcadas = new Set([...form.querySelectorAll('input[name="midia"]:checked')].map((i) => i.value));
      const mudancas = midias.filter((m) => partesDaMidia(m, projeto.id).includes(parteId) !== marcadas.has(m.id));
      await Promise.all(mudancas.map((m) => {
        const atuais = partesDaMidia(m, projeto.id);
        const novas = marcadas.has(m.id) ? [...atuais, parteId] : atuais.filter((i) => i !== parteId);
        return store.updateMidia(m.id, { partesPorProjeto: { ...(m.partesPorProjeto || {}), [projeto.id]: novas } });
      }));
      window.dispatchEvent(new CustomEvent("data-changed"));
    },
  });
}
