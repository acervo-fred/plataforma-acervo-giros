/* Protocolo de Arquivamento — checklist de organização de pastas de um
   projeto: 12 seções fixas em acordeão, árvore estilo Finder (ícone de
   pasta + indentação), cada item-folha com dois estados (Criada /
   Organizada) e uma observação livre, barra de progresso geral, painel
   estático com as 6 fases do processo, botões de marcação em massa,
   criação real das pastas no computador (File System Access API) e
   exportação em PDF. Sem projeto (rota #/protocolo, sem id), mostra
   uma lista pra escolher qual projeto abrir, com o percentual de cada um. */

import { store } from "../data/store.js";
import { esc, compararNomes, toast } from "../ui/dom.js";
import { suportaSelecaoPastas } from "../ui/pasta-tree.js";
import { SECOES_PROTOCOLO, FASES_PROCESSO, idsFolha, idsFolhaDaSecao } from "../data/protocolo-arquivamento.js";

const FOLDER_ICON = `<svg class="tm-node-ic" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>`;

// ícones das 6 fases (capa), na mesma ordem de FASES_PROCESSO — estilo
// de linha minimalista, igual ao resto do app (vem do PDF de referência)
const fase = (paths) => `<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const ICONES_FASES = [
  fase(`<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>`), // levantamento — lupa
  fase(`<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>`), // organização — pasta
  fase(`<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>`), // catalogação brutos — lista
  fase(`<path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>`), // catalogação adicional — etiqueta
  fase(`<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>`), // backup — disco
  fase(`<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>`), // arquivamento — caixa
];

// seta indicando a sequência das etapas dentro de cada linha (1→2→3 e
// 4→5→6) — gira 90° via CSS no mobile, quando os cards empilham
const ARROW_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><polyline points="13 5 20 12 13 19"/></svg>`;

export async function renderProtocolo(app, projetoId) {
  if (!projetoId) return renderEscolhaProjeto(app);

  const [projeto, protocolo] = await Promise.all([
    store.getProjeto(projetoId),
    store.getProtocolo(projetoId),
  ]);
  if (!projeto) {
    app.innerHTML = `<a class="back-link" href="#/protocolo">← Voltar</a>
      <div class="empty">Projeto não encontrado.</div>`;
    return;
  }

  renderChecklist(app, projeto, protocolo);
}

/* ---------- tela de escolha (lista de projetos, com progresso) ---------- */

// created (sem organized) conta como "iniciado" — criar as pastas já é
// começar o processo, não é a mesma coisa que "nada feito ainda"
function pctProjeto(p) {
  const dados = p.protocoloArquivamento || {};
  const leafs = idsFolha();
  const organized = leafs.filter((id) => dados[id]?.organized).length;
  const created = leafs.filter((id) => dados[id]?.created && !dados[id]?.organized).length;
  const total = leafs.length;
  return {
    total,
    pctOrganized: total ? Math.round((organized / total) * 100) : 0,
    pctCreated: total ? Math.round((created / total) * 100) : 0,
    iniciado: organized + created > 0,
    completo: total > 0 && organized === total,
  };
}

function progressoHtml(stats) {
  const { pctOrganized, pctCreated, iniciado, completo } = stats;
  const rotulo = !iniciado ? "Não iniciado" : completo ? "Completo" : pctOrganized > 0 ? `${pctOrganized}% concluído` : "Iniciado";
  const pctTotal = pctOrganized + pctCreated;
  return `<span class="proto-progress" title="${esc(rotulo)}">
    <span class="proto-donut" style="--pct-org:${pctOrganized};--pct-total:${pctTotal}"></span>
    <span class="proto-pct-label">${esc(rotulo)}</span>
  </span>`;
}

function faseCardHtml(f, numero) {
  return `<div class="fase-card">
    <div class="fase-card-num">${numero}</div>
    <div class="fase-card-icon">${ICONES_FASES[numero - 1]}</div>
    <div class="fase-card-titulo">${esc(f.titulo)}</div>
    <div class="fase-card-desc">${esc(f.desc)}</div>
  </div>`;
}

function faseGridHtml() {
  const cards = FASES_PROCESSO.map((f, i) => faseCardHtml(f, i + 1));
  const seta = `<div class="fase-arrow">${ARROW_ICON}</div>`;
  // setas só dentro de cada linha (1→2→3 e 4→5→6) — sem ligar as duas linhas
  return `<div class="fase-grid">
    ${cards[0]}${seta}${cards[1]}${seta}${cards[2]}
    ${cards[3]}${seta}${cards[4]}${seta}${cards[5]}
  </div>`;
}

async function renderEscolhaProjeto(app) {
  const projetos = await store.listProjetos();
  const ordenados = [...projetos].sort((a, b) => compararNomes(a.nome, b.nome));

  app.innerHTML = `
    <h1 class="page-title">Protocolo de Arquivamento do Acervo</h1>
    <div class="page-sub">Organização e arquivamento de projetos e obras.</div>

    <section class="protocolo-capa">
      ${faseGridHtml()}
    </section>

    <h2 class="protocolo-capa-title">Projetos</h2>
    <div class="list-card">
      ${ordenados.length ? ordenados.map((p) => `
        <a href="#/protocolo/${esc(p.id)}" class="list-row clickable">
          <div class="lr-main"><div class="lr-title">${esc(p.nome)}</div></div>
          ${progressoHtml(pctProjeto(p))}
          <span class="muted">›</span>
        </a>`).join("") : `<div class="empty">Nenhum projeto cadastrado.</div>`}
    </div>
  `;
}

/* ---------- checklist de um projeto ---------- */

function renderChecklist(app, projeto, protocolo) {
  app.innerHTML = `
    <a class="back-link" href="#/projeto/${esc(projeto.id)}">← Voltar para ${esc(projeto.nome)}</a>

    <div class="page-head">
      <div>
        <h1 class="page-title">Protocolo de Arquivamento do Acervo</h1>
        <div class="page-sub">${esc(projeto.nome)} · organização de pastas e backup</div>
      </div>
    </div>

    <div class="prog-bar" id="protocolo-bar"></div>
    <div class="prog-legend" style="margin-bottom:16px">
      <span class="prog-leg-item"><span class="prog-dot" style="background:var(--c-green-fg)"></span><span id="protocolo-leg-done"></span></span>
      <span class="prog-leg-item"><span class="prog-dot prog-dot-check"></span><span id="protocolo-leg-proc"></span></span>
      <span class="prog-leg-item"><span class="prog-dot" style="background:var(--c-gray-bg)"></span><span id="protocolo-leg-nao"></span></span>
    </div>

    <div class="toolbar protocolo-toolbar" style="margin-bottom:16px">
      <button type="button" class="btn btn-ghost edit-only" data-act="marcar-criado">Marcar tudo como criado</button>
      <button type="button" class="btn btn-ghost edit-only" data-act="marcar-organizado">Marcar tudo como organizado</button>
      <button type="button" class="btn btn-primary edit-only" data-act="criar-pastas" ${suportaSelecaoPastas() ? "" : "disabled"}>Criar todas as pastas</button>
      <button type="button" class="btn btn-ghost" data-act="exportar-pdf">Exportar PDF</button>
    </div>
    ${suportaSelecaoPastas() ? "" : `<div class="note edit-only"><span class="note-i">ⓘ</span> Esse navegador não sabe criar pastas no computador. Abra pelo Google Chrome.</div>`}

    <details class="protocolo-fases">
      <summary>Fases do processo <span class="section-hint">referência — não interativo</span></summary>
      <ol class="fases-list">
        ${FASES_PROCESSO.map((f) => `<li><strong>${esc(f.titulo)}</strong> — ${esc(f.desc)}</li>`).join("")}
      </ol>
    </details>

    <div id="protocolo-secoes">
      ${SECOES_PROTOCOLO.map((s) => secaoHtml(s, protocolo)).join("")}
    </div>
  `;

  atualizarBarra(app, protocolo);
  ligarToggles(app, projeto.id, protocolo);
  ligarNotas(app, projeto.id, protocolo);
  ligarToolbar(app, projeto, protocolo);
}

function secaoHtml(secao, protocolo) {
  const leafs = idsFolhaDaSecao(secao);
  const done = leafs.filter((id) => protocolo[id]?.organized).length;
  return `<details class="protocolo-secao" data-leafs="${esc(JSON.stringify(leafs))}">
    <summary>
      <span class="ps-title">${esc(secao.id)}. ${esc(secao.title)}</span>
      <span class="ps-count">${done}/${leafs.length} feitas</span>
    </summary>
    <div class="tm-tree protocolo-tree">
      ${leafs.length ? secao.items.map((item) => itemHtml(item, protocolo, 0)).join("")
        : `<div class="empty">Sem itens nesta seção.</div>`}
    </div>
  </details>`;
}

function itemHtml(item, protocolo, nivel) {
  const indent = 12 + nivel * 20;
  if (item.children) {
    return `<div class="tm-node-row" style="padding-left:${indent}px">
      ${FOLDER_ICON}
      <span class="tm-node-nome" style="font-weight:650" title="${esc(item.name)}">${esc(item.name)}</span>
    </div>${item.children.map((c) => itemHtml(c, protocolo, nivel + 1)).join("")}`;
  }
  const estado = protocolo[item.id] || { created: false, organized: false, nota: "" };
  const titulo = `${item.id} ${item.name}${item.desc ? ` — ${item.desc}` : ""}`;
  return `<div class="tm-node-row protocolo-node" data-item="${esc(item.id)}" style="padding-left:${indent}px">
    ${FOLDER_ICON}
    <span class="tm-node-nome" title="${esc(titulo)}">${esc(item.id)} ${esc(item.name)}</span>
    <input type="text" class="input proto-node-nota edit-only-inert" data-nota="${esc(item.id)}" placeholder="Observação…" value="${esc(estado.nota || "")}" />
    <div class="protocolo-toggles edit-only-inert">
      <button type="button" class="proto-toggle ${estado.created ? "is-on" : ""}" data-item="${esc(item.id)}" data-campo="created">Criada</button>
      <button type="button" class="proto-toggle ${estado.organized ? "is-on" : ""}" data-item="${esc(item.id)}" data-campo="organized">Organizada</button>
    </div>
  </div>`;
}

/* ---------- toggles individuais ---------- */

function patchDe(campo, valor) {
  return campo === "organized"
    ? (valor ? { organized: true, created: true } : { organized: false })
    : (valor ? { created: true } : { created: false, organized: false });
}

// ids como "11.1.1" são literais dentro de aspas no seletor — não
// precisam de escape (CSS só exigiria escape fora de um valor citado)
function aplicarPatchNoDom(app, itemId, estadoNovo) {
  const linha = app.querySelector(`.protocolo-node[data-item="${itemId}"]`);
  if (!linha) return;
  linha.querySelector('[data-campo="created"]')?.classList.toggle("is-on", estadoNovo.created);
  linha.querySelector('[data-campo="organized"]')?.classList.toggle("is-on", estadoNovo.organized);
}

function ligarToggles(app, projetoId, protocolo) {
  app.querySelectorAll(".proto-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const itemId = btn.dataset.item;
      const campo = btn.dataset.campo;
      const valorNovo = !btn.classList.contains("is-on");
      const atual = protocolo[itemId] || { created: false, organized: false, nota: "" };
      protocolo[itemId] = { ...atual, ...patchDe(campo, valorNovo) };

      aplicarPatchNoDom(app, itemId, protocolo[itemId]);
      atualizarContadores(app, protocolo);
      store.setProtocoloItem(projetoId, itemId, campo, valorNovo);
    });
  });
}

/* ---------- observações (notas) ---------- */

function ligarNotas(app, projetoId, protocolo) {
  app.querySelectorAll(".proto-node-nota").forEach((input) => {
    input.addEventListener("blur", () => {
      const itemId = input.dataset.nota;
      const atual = protocolo[itemId] || { created: false, organized: false, nota: "" };
      const texto = input.value;
      if (texto === atual.nota) return;
      protocolo[itemId] = { ...atual, nota: texto };
      store.setProtocoloNota(projetoId, itemId, texto);
    });
  });
}

/* ---------- contadores / barra ---------- */

function atualizarContadores(app, protocolo) {
  app.querySelectorAll(".protocolo-secao").forEach((el) => {
    const ids = JSON.parse(el.dataset.leafs || "[]");
    const done = ids.filter((id) => protocolo[id]?.organized).length;
    el.querySelector(".ps-count").textContent = `${done}/${ids.length} feitas`;
  });
  atualizarBarra(app, protocolo);
}

function atualizarBarra(app, protocolo) {
  const leafs = idsFolha();
  const total = leafs.length;
  const done = leafs.filter((id) => protocolo[id]?.organized).length;
  const proc = leafs.filter((id) => protocolo[id]?.created && !protocolo[id]?.organized).length;
  const nao = total - done - proc;
  const pctDone = total ? Math.round((done / total) * 100) : 0;
  const pctProc = total ? Math.round((proc / total) * 100) : 0;
  const pctNao = 100 - pctDone - pctProc;

  app.querySelector("#protocolo-bar").innerHTML = `
    ${pctDone ? `<div class="prog-seg prog-done" style="width:${pctDone}%"></div>` : ""}
    ${pctProc ? `<div class="prog-seg prog-proc" style="width:${pctProc}%"></div>` : ""}
    ${pctNao ? `<div class="prog-seg prog-nao" style="width:${pctNao}%"></div>` : ""}
  `;
  app.querySelector("#protocolo-leg-done").textContent = `Organizada (${done}/${total})`;
  app.querySelector("#protocolo-leg-proc").textContent = `Criada, não organizada (${proc}/${total})`;
  app.querySelector("#protocolo-leg-nao").textContent = `Não iniciada (${nao}/${total})`;
}

/* ---------- toolbar: marcar tudo / criar pastas / exportar PDF ---------- */

function ligarToolbar(app, projeto, protocolo) {
  const acoes = {
    "marcar-criado": () => marcarTodos(app, projeto.id, protocolo, "created", true, "Marcar todos os itens como Criada?"),
    "marcar-organizado": () => marcarTodos(app, projeto.id, protocolo, "organized", true, "Marcar todos os itens como Organizada? (isso também marca todos como Criada)"),
    "criar-pastas": (btn) => criarTodasAsPastas(app, btn, projeto, protocolo),
    "exportar-pdf": (btn) => exportarPdf(btn, projeto, protocolo),
  };
  app.querySelector(".protocolo-toolbar").querySelectorAll("[data-act]").forEach((btn) =>
    btn.addEventListener("click", () => acoes[btn.dataset.act]?.(btn))
  );
}

function marcarTodos(app, projetoId, protocolo, campo, valor, msgConfirm) {
  if (!confirm(msgConfirm)) return;
  aplicarTodos(app, projetoId, protocolo, campo, valor);
}

function aplicarTodos(app, projetoId, protocolo, campo, valor) {
  const patch = patchDe(campo, valor);
  for (const id of idsFolha()) {
    const atual = protocolo[id] || { created: false, organized: false, nota: "" };
    protocolo[id] = { ...atual, ...patch };
    aplicarPatchNoDom(app, id, protocolo[id]);
  }
  atualizarContadores(app, protocolo);
  store.setProtocoloTodos(projetoId, campo, valor);
}

// nomes de arquivo/pasta seguros em qualquer sistema de arquivos
function nomeSeguro(s) {
  return String(s).replace(/[\\/:*?"<>|]+/g, "-").trim();
}

async function criarTodasAsPastas(app, btn, projeto, protocolo) {
  let raiz;
  try {
    raiz = await window.showDirectoryPicker();
  } catch {
    return; // cancelado
  }
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Criando pastas…";
  try {
    const projPasta = await raiz.getDirectoryHandle(nomeSeguro(projeto.nome), { create: true });
    for (const secao of SECOES_PROTOCOLO) {
      if (!secao.items.length) continue;
      const secPasta = await projPasta.getDirectoryHandle(nomeSeguro(`${secao.id}. ${secao.title}`), { create: true });
      for (const item of secao.items) {
        if (item.children) {
          const grupoPasta = await secPasta.getDirectoryHandle(nomeSeguro(`${item.id} ${item.name}`), { create: true });
          for (const c of item.children) {
            await grupoPasta.getDirectoryHandle(nomeSeguro(`${c.id} ${c.name}`), { create: true });
          }
        } else {
          await secPasta.getDirectoryHandle(nomeSeguro(`${item.id} ${item.name}`), { create: true });
        }
      }
    }
    aplicarTodos(app, projeto.id, protocolo, "created", true);
    toast(`Pastas criadas em "${raiz.name}/${projeto.nome}".`);
  } catch (err) {
    console.error(err);
    toast("Não foi possível criar as pastas. Veja o console pra detalhes.");
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

async function exportarPdf(btn, projeto, protocolo) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Gerando PDF…";
  try {
    const { jsPDF } = await import("https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const marginX = 40;
    const pageH = doc.internal.pageSize.getHeight();
    let y = 50;

    const linha = (texto, { bold = false, size = 10, indent = 0, cor = 0, alturaLinha = 14 } = {}) => {
      if (y > pageH - 40) { doc.addPage(); y = 50; }
      doc.setFont(undefined, bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.setTextColor(cor);
      doc.text(texto, marginX + indent, y);
      y += alturaLinha;
    };

    linha("Protocolo de Arquivamento", { bold: true, size: 16, alturaLinha: 22 });
    linha(projeto.nome, { size: 12, alturaLinha: 16 });
    linha(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, { size: 9, cor: 120, alturaLinha: 22 });

    const linhaItem = (item, indent) => {
      const estado = protocolo[item.id] || { created: false, organized: false, nota: "" };
      const marca = estado.organized ? "[x]" : estado.created ? "[~]" : "[ ]";
      const status = estado.organized ? "Organizada" : estado.created ? "Criada" : "Não iniciada";
      linha(`${marca} ${item.id} ${item.name} — ${status}`, { indent });
      if (estado.nota) linha(`Obs.: ${estado.nota}`, { indent: indent + 14, size: 9, cor: 90 });
    };

    for (const secao of SECOES_PROTOCOLO) {
      if (!secao.items.length) continue;
      linha(`${secao.id}. ${secao.title}`, { bold: true, size: 12, alturaLinha: 18 });
      for (const item of secao.items) {
        if (item.children) {
          linha(item.name, { bold: true, indent: 14 });
          for (const c of item.children) linhaItem(c, 28);
        } else {
          linhaItem(item, 14);
        }
      }
      y += 6;
    }

    doc.save(nomeSeguro(`${projeto.nome} - Protocolo de Arquivamento.pdf`));
  } catch (err) {
    console.error(err);
    toast("Não foi possível gerar o PDF.");
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}
