/* Dashboard — números agregados, gráficos de barras (CSS puro) e
   lista de pendências de prioridade alta.

   Indicador-chave: "Mídias com mistura" = mídias com mais de um
   projeto dentro (acompanha o progresso de reorganização). */

import { store } from "../data/store.js";
import { esc } from "../ui/dom.js";
import { badgeFromLista, corDoValor } from "../ui/badges.js";
import { idsFolha } from "../data/protocolo-arquivamento.js";

export async function renderDashboard(app) {
  const [projetos, midias, demandas, fitas, listas] = await Promise.all([
    store.listProjetos(),
    store.listMidias(),
    store.listDemandas(),
    store.listFitas(),
    store.getListas(),
  ]);

  const nomePorId = Object.fromEntries(projetos.map((p) => [p.id, p.nome]));

  // ---- números ----
  const totalProjetos = projetos.length;
  const totalMidias = midias.length;
  const pendentesAbertas = demandas.filter((d) => d.status === "Aberta" || d.status === "Em andamento").length;
  const midiasMistura = midias.filter((m) => (m.projetosArmazenados || []).length > 1).length;

  // ---- contagens p/ gráficos ----
  const valoresTipoMidia = listas.tipoMidia.map((t) => (typeof t === "string" ? t : t.valor));
  const porStatus = contar(listas.statusProjeto.map((s) => s.valor), projetos.map((p) => p.statusProjeto));
  const porTipo = contar(valoresTipoMidia, midias.map((m) => m.tipo));

  // ---- armazenamento por tipo (TB) ----
  const armPorTipo = somarCapacidade(valoresTipoMidia, midias);

  // ---- progresso de catalogação ----
  const catalogados = projetos.filter((p) => p.statusProjeto === "Catalogado" || p.statusProjeto === "Finalizado" || p.statusProjeto === "Arquivado").length;
  const emProcesso = projetos.filter((p) => p.statusProjeto === "Catalogando").length;
  const naoCatalogados = totalProjetos - catalogados - emProcesso;

  // ---- progresso de arquivamento (consolidado — soma o checklist do
  // Protocolo de todos os projetos, item por item) ----
  const foldersProtocolo = idsFolha();
  let arqOrganizadas = 0, arqCriadas = 0, arqTotalItens = 0;
  for (const p of projetos) {
    const dados = p.protocoloArquivamento || {};
    for (const id of foldersProtocolo) {
      arqTotalItens++;
      if (dados[id]?.organized) arqOrganizadas++;
      else if (dados[id]?.created) arqCriadas++;
    }
  }
  const arqNaoIniciadas = arqTotalItens - arqOrganizadas - arqCriadas;

  // ---- fitas ----
  const totalFitas = fitas.length;
  const fitasDigitalizadas = fitas.filter((f) => f.statusFita === "Digitalizada").length;
  const fitasEmProcesso = fitas.filter((f) => f.statusFita === "Em digitalização" || f.statusFita === "Aguardando digitalização").length;

  // ---- pendências alta prioridade (abertas/andamento) ----
  const altaPrioridade = demandas.filter(
    (d) => d.prioridade === "Alta" && d.status !== "Concluída" && d.status !== "Cancelada"
  );

  app.innerHTML = `
    <div class="page-head">
      <div><h1 class="page-title">Dashboard</h1>
        <div class="page-sub">Visão geral do acervo</div></div>
    </div>

    <div class="stat-grid">
      ${stat(totalProjetos, "Projetos", "accent")}
      ${stat(totalMidias, "Mídias")}
      ${stat(pendentesAbertas, "Pendências em aberto")}
      ${statMistura(midiasMistura)}
    </div>

    <div class="chart-card" style="margin-bottom:24px">
      <h3>Progresso de catalogação</h3>
      ${progressoCatalogacao(catalogados, emProcesso, naoCatalogados, totalProjetos)}
    </div>

    <div class="chart-card" style="margin-bottom:24px">
      <h3>Progresso de Arquivamento <span class="section-hint">todos os projetos, pasta por pasta</span></h3>
      ${progressoArquivamento(arqOrganizadas, arqCriadas, arqNaoIniciadas, arqTotalItens, totalProjetos)}
    </div>

    <div class="dash-cols">
      <div class="chart-card">
        <h3>Projetos por status</h3>
        ${barChart(porStatus, listas.statusProjeto)}
      </div>
      <div class="chart-card">
        <h3>Digitalização de fitas</h3>
        ${fitaVHS(fitasDigitalizadas, fitasEmProcesso, totalFitas)}
      </div>
    </div>

    <div class="dash-cols">
      <div class="chart-card">
        <h3>Armazenamento por tipo</h3>
        ${barChartValor(armPorTipo)}
      </div>
      <div class="chart-card">
        <h3>Mídias por tipo</h3>
        ${barChart(porTipo, listas.tipoMidia, "slate")}
      </div>
    </div>

    <section class="section">
      <div class="section-head"><h2>Pendências de prioridade alta</h2></div>
      <div class="list-card" id="alta">
        ${altaPrioridade.length
          ? altaPrioridade.map((d) => demandaRow(d, nomePorId, listas)).join("")
          : `<div class="empty">Nenhuma pendência de prioridade alta. 🎉</div>`}
      </div>
    </section>
  `;

  app.querySelector("#alta").addEventListener("click", (e) => {
    const row = e.target.closest("[data-projeto]");
    if (row) location.hash = `#/projeto/${row.dataset.projeto}`;
  });
}

/* conta ocorrências de cada categoria, preservando a ordem da lista */
function contar(categorias, valores) {
  const mapa = Object.fromEntries(categorias.map((c) => [c, 0]));
  valores.forEach((v) => { mapa[v] = (mapa[v] || 0) + 1; });
  return Object.entries(mapa).map(([label, n]) => ({ label, n }));
}

function stat(num, label, cls = "") {
  return `<div class="stat ${cls}">
    <div class="stat-num">${num}</div>
    <div class="stat-label">${esc(label)}</div>
  </div>`;
}

function statMistura(n) {
  return `<div class="stat warn-stat">
    <div class="stat-num ${n > 0 ? "is-amber" : ""}">${n}</div>
    <div class="stat-label">Mídias com mistura</div>
  </div>`;
}

/* gráfico de barras horizontal; cor vem da lista (se tiver) ou de corPadrao */
function barChart(dados, lista, corPadrao = null) {
  const max = Math.max(1, ...dados.map((d) => d.n));
  return dados.map((d) => {
    const cor = corPadrao || corDoValor(lista, d.label, "slate");
    const pct = Math.round((d.n / max) * 100);
    return `<div class="bar-row">
      <div class="bar-label">${esc(d.label)}</div>
      <div class="bar-track"><div class="bar-fill bf--${esc(cor)}" style="width:${pct}%"></div></div>
      <div class="bar-val">${d.n}</div>
    </div>`;
  }).join("");
}

/* parse "8TB" / "500GB" → valor em GB */
function parseCapacidadeGB(str) {
  if (!str) return 0;
  const m = /^([\d.,]+)\s*(TB|GB|MB)/i.exec(str.trim());
  if (!m) return 0;
  const n = parseFloat(m[1].replace(",", "."));
  const u = m[2].toUpperCase();
  if (u === "TB") return n * 1024;
  if (u === "GB") return n;
  if (u === "MB") return n / 1024;
  return 0;
}

function formatarCapacidade(gb) {
  if (gb >= 1024) return `${+(gb / 1024).toFixed(1)} TB`;
  return `${+gb.toFixed(1)} GB`;
}

function somarCapacidade(tipos, midias) {
  const mapa = Object.fromEntries(tipos.map((t) => [t, 0]));
  midias.forEach((m) => {
    const gb = parseCapacidadeGB(m.capacidade);
    mapa[m.tipo] = (mapa[m.tipo] || 0) + gb;
  });
  return Object.entries(mapa)
    .map(([label, gb]) => ({ label, gb }))
    .filter((d) => d.gb > 0);
}

function barChartValor(dados) {
  const max = Math.max(1, ...dados.map((d) => d.gb));
  return dados.map((d) => {
    const pct = Math.round((d.gb / max) * 100);
    return `<div class="bar-row">
      <div class="bar-label">${esc(d.label)}</div>
      <div class="bar-track"><div class="bar-fill bf--slate" style="width:${pct}%"></div></div>
      <div class="bar-val" style="width:auto;min-width:50px">${formatarCapacidade(d.gb)}</div>
    </div>`;
  }).join("");
}

function progressoCatalogacao(catalogados, emProcesso, nao, total) {
  if (!total) return `<div class="empty">Sem projetos.</div>`;
  const pctDone = Math.round((catalogados / total) * 100);
  const pctProc = Math.round((emProcesso / total) * 100);
  const pctNao = 100 - pctDone - pctProc;
  return `
    <div class="prog-bar">
      ${pctDone ? `<div class="prog-seg prog-done" style="width:${pctDone}%"></div>` : ""}
      ${pctProc ? `<div class="prog-seg prog-proc" style="width:${pctProc}%"></div>` : ""}
      ${pctNao ? `<div class="prog-seg prog-nao" style="width:${pctNao}%"></div>` : ""}
    </div>
    <div class="prog-legend">
      <span class="prog-leg-item"><span class="prog-dot" style="background:var(--c-green-fg)"></span> <strong>Catalogado</strong> · ${catalogados} (${pctDone}%)</span>
      <span class="prog-leg-item"><span class="prog-dot prog-dot-check"></span> <strong>Em catalogação</strong> · ${emProcesso} (${pctProc}%)</span>
      <span class="prog-leg-item"><span class="prog-dot" style="background:var(--c-gray-bg)"></span> <strong>Não catalogado</strong> · ${nao} (${pctNao}%)</span>
    </div>
    <div style="margin-top:10px;font-size:13px;color:var(--text-soft)">Total: ${total} projetos</div>`;
}

// mesma lógica de 3 estados da catalogação, mas em vez de cada projeto
// ter 1 status discreto, cada um contribui uma fração (pastas
// organizadas/criadas do seu checklist de 31 itens) — as barras somam
// essas frações e mostram tudo em "equivalente de projetos", nunca em
// contagem de pastas
function progressoArquivamento(organizadas, criadas, nao, totalItens, totalProjetos) {
  if (!totalProjetos) return `<div class="empty">Sem projetos.</div>`;
  const pctDone = Math.round((organizadas / totalItens) * 100);
  const pctProc = Math.round((criadas / totalItens) * 100);
  const pctNao = 100 - pctDone - pctProc;
  const itensPorProjeto = totalItens / totalProjetos;
  const eq = (n) => (n / itensPorProjeto).toFixed(1);
  return `
    <div class="prog-bar">
      ${pctDone ? `<div class="prog-seg prog-done" style="width:${pctDone}%"></div>` : ""}
      ${pctProc ? `<div class="prog-seg prog-proc" style="width:${pctProc}%"></div>` : ""}
      ${pctNao ? `<div class="prog-seg prog-nao" style="width:${pctNao}%"></div>` : ""}
    </div>
    <div class="prog-legend">
      <span class="prog-leg-item"><span class="prog-dot" style="background:var(--c-green-fg)"></span> <strong>Organizada</strong> · ${eq(organizadas)} de ${totalProjetos} projetos (${pctDone}%)</span>
      <span class="prog-leg-item"><span class="prog-dot prog-dot-check"></span> <strong>Criada, não organizada</strong> · ${eq(criadas)} de ${totalProjetos} projetos (${pctProc}%)</span>
      <span class="prog-leg-item"><span class="prog-dot" style="background:var(--c-gray-bg)"></span> <strong>Não iniciada</strong> · ${eq(nao)} de ${totalProjetos} projetos (${pctNao}%)</span>
    </div>
    <div style="margin-top:10px;font-size:13px;color:var(--text-soft)">Total: ${totalProjetos} projetos</div>`;
}

function fitaVHS(digitalizadas, emProcesso, total) {
  if (!total) return `<div class="vhs-empty">Nenhuma fita cadastrada.<br><a href="#/fitas">Ir para Fitas →</a></div>`;
  const pctDone = (digitalizadas / total) * 100;
  const pctProc = (emProcesso / total) * 100;
  const restante = total - digitalizadas - emProcesso;
  const pctDoneR = Math.round(pctDone);
  const pctProcR = Math.round(pctProc);
  const pctRest = 100 - pctDoneR - pctProcR;

  return `
    <div class="vhs-card">
      <div class="vhs-container">
        <div class="vhs-fill-wrapper">
          <div class="vhs-fill-done" style="width:${pctDone}%"></div>
          <div class="vhs-fill-proc" style="width:${pctProc}%;left:${pctDone}%"></div>
        </div>
        <img src="./FITA_VHS.png" class="vhs-img" alt="Fita VHS" />
      </div>
      <div class="vhs-legend-row">
        <span class="vhs-leg-item"><span class="prog-dot" style="background:var(--text);opacity:0.6"></span> Digitalizada <strong>${digitalizadas}</strong> <span class="muted">(${pctDoneR}%)</span></span>
        <span class="vhs-leg-item"><span class="prog-dot vhs-dot-proc"></span> Em processo <strong>${emProcesso}</strong> <span class="muted">(${pctProcR}%)</span></span>
        <span class="vhs-leg-item"><span class="prog-dot" style="background:var(--c-gray-bg)"></span> Restante <strong>${restante}</strong> <span class="muted">(${pctRest}%)</span></span>
      </div>
    </div>`;
}

function demandaRow(d, nomePorId, listas) {
  return `<div class="list-row clickable" data-projeto="${esc(d.projetoId)}">
    <div class="lr-main">
      <div class="lr-title">${esc(d.pendencia)}</div>
      <div class="lr-sub">${esc(nomePorId[d.projetoId] || "—")} · ${esc(d.responsavel || "—")}</div>
    </div>
    ${badgeFromLista(listas.prioridade, d.prioridade)}
    ${badgeFromLista(listas.statusDemanda, d.status)}
    <span class="muted">›</span>
  </div>`;
}
