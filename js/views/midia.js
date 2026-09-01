/* Detalhe da Mídia — dados da mídia, aviso de "mistura" (mais de um
   projeto dentro), lista clicável de Projetos armazenados (cada um na
   cor do próprio status), e o campo Conteúdo (observações). */

import { store } from "../data/store.js";
import { esc, formatAno, toast } from "../ui/dom.js";
import { badgeFromLista, corDoValor } from "../ui/badges.js";
import { abrirNovaMidia, abrirNovaEstrutura } from "./cadastros.js";
import { openModal, fieldText, fieldTextarea, readValue } from "../ui/modal.js";
import { suportaSelecaoPastas } from "../ui/pasta-tree.js";
import { gerarListaArquivos, baixarTxt, TAMANHO_SEGURO_FIRESTORE } from "../ui/lista-arquivos.js";
import { usuarioAtual } from "../data/auth.js";

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

    <!-- LISTA DE TODOS OS ARQUIVOS -->
    <section class="section">
      <div class="section-head"><h2>Lista de todos os arquivos da mídia</h2></div>
      <div class="list-card" id="lista-arquivos">
        ${listaArquivosRow(midia)}
      </div>
      ${suportaSelecaoPastas() ? "" : `<div class="note"><span class="note-i">ⓘ</span> Esse navegador não sabe ler pastas do computador. Abra pelo Google Chrome.</div>`}
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
    "gerar-lista": (btn) => abrirOpcoesGerarLista(midia, btn),
    "ver-lista": () => abrirListaArquivos(midia),
  };
  app.querySelectorAll("[data-act]").forEach((btn) =>
    btn.addEventListener("click", () => acoes[btn.dataset.act]?.(btn))
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

function listaArquivosRow(midia) {
  // gerada, mas grande demais pra guardar no documento da mídia (limite
  // de 1MB do Firestore) — só as estatísticas ficaram salvas; o .txt já
  // foi baixado na hora da geração. Depende do campo explícito (e não
  // só da ausência de listaArquivos) pra não confundir com mídias
  // antigas cujo texto ficou vazio por outro motivo, sem relação com
  // tamanho.
  if (midia.listaArquivosMuitoGrande) {
    const data = midia.listaArquivosGeradoEm
      ? new Date(midia.listaArquivosGeradoEm).toLocaleDateString("pt-BR")
      : "—";
    const resumo = [`${midia.listaArquivosArquivos} arquivos`, `${midia.listaArquivosPastas} pastas`].join(" · ");
    return `<div class="list-row">
      <div class="lr-main">
        <div class="lr-title">Lista gerada em ${esc(data)} <span class="muted" style="font-weight:400">— grande demais pra guardar na plataforma</span></div>
        <div class="lr-sub">${esc(resumo)} · baixada como .txt na hora. Gere de novo pra baixar outra cópia.</div>
      </div>
      <button class="btn btn-primary edit-only" data-act="gerar-lista" ${suportaSelecaoPastas() ? "" : "disabled"}>Gerar de novo</button>
    </div>`;
  }
  if (!midia.listaArquivos) {
    return `<div class="list-row">
      <div class="lr-main">
        <div class="lr-title">Nenhuma lista gerada ainda</div>
        <div class="lr-sub">Gera um arquivo .txt com todos os arquivos desta mídia, organizados por pasta e subpasta.</div>
      </div>
      <button class="btn btn-primary edit-only" data-act="gerar-lista" ${suportaSelecaoPastas() ? "" : "disabled"}>Gerar lista</button>
    </div>`;
  }
  const data = midia.listaArquivosGeradoEm
    ? new Date(midia.listaArquivosGeradoEm).toLocaleDateString("pt-BR")
    : "—";
  const resumo = [
    midia.listaArquivosArquivos != null ? `${midia.listaArquivosArquivos} arquivos` : null,
    midia.listaArquivosPastas != null ? `${midia.listaArquivosPastas} pastas` : null,
  ].filter(Boolean).join(" · ");
  return `<div class="list-row">
    <div class="lr-main">
      <div class="lr-title">Lista gerada em ${esc(data)}</div>
      ${resumo ? `<div class="lr-sub">${esc(resumo)}</div>` : ""}
    </div>
    <button class="btn btn-ghost" data-act="ver-lista">Ver lista</button>
  </div>`;
}

// pequeno modal só pra escolher o filtro de tamanho antes de escanear
function abrirOpcoesGerarLista(midia, btn) {
  const modal = openModal({
    title: "Gerar lista de arquivos",
    subtitle: midia.nome,
    submitLabel: "Escolher pasta e escanear",
    bodyHtml: fieldText("minKb", "Ignorar arquivos menores que (KB)", {
      type: "number", value: "0",
      hint: "As pastas sempre entram inteiras na lista — isso só omite arquivos pequenos (proxies, sequências de frames etc). Deixe 0 pra listar todos os arquivos.",
    }),
    onSubmit: async (form) => {
      const minBytes = Math.max(0, Number(readValue(form, "minKb")) || 0) * 1024;
      modal.close();
      await gerarEPersistirLista(midia, btn, minBytes);
    },
  });
}

async function gerarEPersistirLista(midia, btn, minBytes = 0) {
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Escaneando…";
  try {
    const resultado = await gerarListaArquivos({ minBytes });
    if (!resultado) return; // cancelado na escolha da pasta
    const campos = {
      listaArquivosGeradoEm: new Date().toISOString(),
      listaArquivosArquivos: resultado.arquivos,
      listaArquivosPastas: resultado.pastas,
      listaArquivosMuitoGrande: resultado.grandeDemaisPraSalvar,
      // texto grande demais pro documento da mídia (limite de 1MB do
      // Firestore) não é gravado — só as estatísticas acima
      listaArquivos: resultado.grandeDemaisPraSalvar ? "" : resultado.texto,
    };
    Object.assign(midia, campos);
    await store.updateMidia(midia.id, campos);
    if (resultado.grandeDemaisPraSalvar) {
      baixarTxt(`${midia.nome} - lista de arquivos.txt`, resultado.texto);
      toast("Lista grande demais pra guardar na plataforma — baixada como .txt.");
    } else if (resultado.truncado) {
      toast("Mídia com muitos itens — a lista mostra só os primeiros.");
    } else if (resultado.ignorados) {
      toast(`${resultado.ignorados} arquivo${resultado.ignorados > 1 ? "s" : ""} pequeno${resultado.ignorados > 1 ? "s" : ""} ignorado${resultado.ignorados > 1 ? "s" : ""} na lista.`);
    }
    window.dispatchEvent(new CustomEvent("data-changed"));
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}

function abrirListaArquivos(midia) {
  const editor = !!usuarioAtual();
  openModal({
    title: "Lista de todos os arquivos",
    subtitle: midia.nome,
    submitLabel: editor ? "Salvar alterações" : "Fechar",
    bodyHtml: `
      <div class="toolbar" style="margin-bottom:10px; flex-wrap:wrap; gap:10px">
        <button type="button" class="btn btn-ghost" data-act="baixar">⬇ Baixar .txt</button>
        <button type="button" class="btn btn-ghost edit-only" data-act="regerar">↻ Gerar novamente (substitui)</button>
        <label class="edit-only" style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-soft)">
          Ignorar arquivos menores que
          <input type="number" class="input" id="lf-min-kb" value="0" min="0" style="width:70px" />
          KB
        </label>
      </div>
      ${fieldTextarea("texto", "Conteúdo", { value: midia.listaArquivos || "" })}
    `,
    onMount: (form) => {
      const textarea = form.querySelector("#f_texto");
      textarea.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
      textarea.style.fontSize = "12.5px";
      textarea.rows = 22;
      if (!editor) textarea.readOnly = true;
      form.querySelector('[data-act="baixar"]')?.addEventListener("click", () => {
        baixarTxt(`${midia.nome} - lista de arquivos.txt`, textarea.value);
      });
      form.querySelector('[data-act="regerar"]')?.addEventListener("click", async (ev) => {
        const btn = ev.currentTarget;
        const textoOriginal = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Escaneando…";
        try {
          const minKb = Math.max(0, Number(form.querySelector("#lf-min-kb")?.value) || 0);
          const resultado = await gerarListaArquivos({ minBytes: minKb * 1024 });
          if (!resultado) return; // cancelado na escolha da pasta
          textarea.value = resultado.texto;
          textarea.dataset.arquivos = resultado.arquivos;
          textarea.dataset.pastas = resultado.pastas;
          if (resultado.truncado) toast("Mídia com muitos itens — a lista mostra só os primeiros.");
          else if (resultado.ignorados) toast(`${resultado.ignorados} arquivo${resultado.ignorados > 1 ? "s" : ""} pequeno${resultado.ignorados > 1 ? "s" : ""} ignorado${resultado.ignorados > 1 ? "s" : ""} na lista.`);
        } finally {
          btn.disabled = false;
          btn.textContent = textoOriginal;
        }
      });
    },
    onSubmit: async (form) => {
      if (!editor) return; // "Fechar" — nada a salvar
      const textarea = form.querySelector("#f_texto");
      const texto = readValue(form, "texto");
      if (new Blob([texto]).size > TAMANHO_SEGURO_FIRESTORE) {
        throw new Error("Essa lista é grande demais pra guardar na plataforma (passa do limite do banco de dados). Clique em \"Baixar .txt\" antes de fechar — essa versão não vai ficar salva aqui.");
      }
      const campos = { listaArquivos: texto, listaArquivosGeradoEm: new Date().toISOString(), listaArquivosMuitoGrande: false };
      if (textarea.dataset.arquivos !== undefined) campos.listaArquivosArquivos = Number(textarea.dataset.arquivos);
      if (textarea.dataset.pastas !== undefined) campos.listaArquivosPastas = Number(textarea.dataset.pastas);
      await store.updateMidia(midia.id, campos);
      window.dispatchEvent(new CustomEvent("data-changed"));
    },
  });
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
