/* Abertura dos modais de cadastro E edição. Cada função aceita um
   registro existente (opcional): se vier, o modal abre em modo
   edição (pré-preenchido) e grava via update; senão, cria via add.

   Após gravar, dispara "data-changed" para a tela atual se re-renderizar. */

import { store } from "../data/store.js";
import { esc, formatAno, compararNomes, toast } from "../ui/dom.js";
import {
  openModal, fieldText, fieldTextarea, fieldSelect, readValue,
} from "../ui/modal.js";
import { imagemParaDataUrl } from "../ui/imagem.js";
import { temporadaVazia, listaPartes, rotuloParte } from "./projeto-partes.js";

// formato do projeto — fixo (não é uma lista configurável em Configurações,
// como statusProjeto/tipoMidia etc.), só controla se aparecem os campos
// de temporadas/episódios
export const FORMATOS = ["Longa-metragem", "Série"];

function avisarMudanca() {
  window.dispatchEvent(new CustomEvent("data-changed"));
}

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function isoParaBR(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}
function brParaISO(br) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br || "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}
// extrai o valor numérico de uma capacidade livre existente (ex.: "8TB" → "8")
function capacidadeParaNumero(str) {
  const m = /([\d.,]+)/.exec(str || "");
  return m ? m[1].replace(",", ".") : "";
}
// itens de lista podem ser string simples ou {valor, ...} (cor/ícone)
function valorDe(it) { return typeof it === "string" ? it : it?.valor; }

/* ---------------- Projeto (criar / editar) ---------------- */
export async function abrirNovoProjeto(existente = null) {
  const listas = await store.getListas();
  const ed = !!existente;
  const p = existente || {};
  const formatoInicial = p.formato || FORMATOS[0];
  openModal({
    title: ed ? "Editar projeto" : "Novo projeto",
    submitLabel: ed ? "Salvar alterações" : "Criar projeto",
    bodyHtml: `
      ${fieldText("nome", "Nome do projeto", { required: true, value: p.nome || "", placeholder: "Ex.: Imortais" })}
      <div class="field-2col">
        ${fieldText("ano", "Ano", { type: "number", value: p.ano && p.ano !== 1900 ? p.ano : "", placeholder: "Deixe em branco se não souber" })}
        ${fieldSelect("statusProjeto", "Status", listas.statusProjeto, { value: p.statusProjeto || listas.statusProjeto[0]?.valor })}
      </div>
      <div class="field-2col">
        ${fieldSelect("formato", "Formato", FORMATOS, { value: formatoInicial })}
        <div></div>
      </div>
      <div id="formato-serie" ${formatoInicial === "Série" ? "" : "hidden"}>
        <div class="field-2col">
          ${fieldText("episodios", "Episódios (total)", { type: "number", value: p.episodios || "", placeholder: "Ex.: 16" })}
          ${ed ? "<div></div>" : fieldText("temporadas", "Temporadas", { type: "number", value: "", placeholder: "Ex.: 2" })}
        </div>
        <div class="field-hint">${ed ? "Temporadas e versões se adicionam e editam pelas abas na página do projeto." : "Cria as abas de temporada já vazias; dá pra adicionar mais depois, na página do projeto."}</div>
      </div>
      ${fieldTextarea("observacoes", "Observações", { value: p.observacoes || "", hint: "Aparece na capa do projeto, junto com formato e ano. Ex.: só prospecção, não chegou a ser gravado." })}
      <div class="field">
        <label>Capa do projeto</label>
        <div class="capa-picker" id="capa-picker">
          <div class="capa-preview" id="capa-preview">${p.capa ? `<img src="${esc(p.capa)}" alt="">` : `<span class="muted">Sem capa</span>`}</div>
          <div class="capa-picker-actions">
            <label class="btn btn-ghost btn-sm capa-escolher">
              Escolher foto…
              <input type="file" accept="image/*" id="capa-file" hidden />
            </label>
            <button type="button" class="btn btn-ghost btn-sm" id="capa-remover" ${p.capa ? "" : "hidden"}>Remover</button>
          </div>
          <input type="hidden" name="capa" id="f_capa" value="${esc(p.capa || "")}" />
        </div>
        <div class="field-hint">Aparece no topo da página do projeto. Sem foto, usa um fundo na cor do status.</div>
      </div>
      <div class="field-hint">Última atualização e links do projeto não ficam aqui — os links se gerenciam na página do projeto.</div>
    `,
    onMount: (form) => {
      // mostra/esconde temporadas·episódios conforme o formato escolhido
      const boxSerie = form.querySelector("#formato-serie");
      form.elements.formato.addEventListener("change", (e) => {
        boxSerie.hidden = e.target.value !== "Série";
      });

      // capa: escolhe um arquivo → comprime em memória → guarda como
      // data URL no campo oculto (nada é enviado pra lugar nenhum)
      const preview = form.querySelector("#capa-preview");
      const hidden = form.querySelector("#f_capa");
      const btnRemover = form.querySelector("#capa-remover");
      form.querySelector("#capa-file").addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        preview.innerHTML = `<span class="muted">Carregando…</span>`;
        try {
          const dataUrl = await imagemParaDataUrl(file);
          hidden.value = dataUrl;
          preview.innerHTML = `<img src="${dataUrl}" alt="">`;
          btnRemover.hidden = false;
        } catch (err) {
          toast(err.message || "Não consegui processar essa imagem.");
          preview.innerHTML = hidden.value ? `<img src="${esc(hidden.value)}" alt="">` : `<span class="muted">Sem capa</span>`;
        }
      });
      btnRemover.addEventListener("click", () => {
        hidden.value = "";
        preview.innerHTML = `<span class="muted">Sem capa</span>`;
        btnRemover.hidden = true;
      });
    },
    onSubmit: async (form) => {
      const nome = readValue(form, "nome");
      if (!nome) throw new Error("Informe o nome do projeto.");
      const formato = readValue(form, "formato");
      const campos = {
        nome,
        ano: Number(readValue(form, "ano")) || 1900,
        statusProjeto: readValue(form, "statusProjeto"),
        formato,
        episodios: formato === "Série" ? Number(readValue(form, "episodios")) || null : null,
        capa: readValue(form, "capa"),
        observacoes: readValue(form, "observacoes") || "",
      };
      if (ed) await store.updateProjeto(p.id, campos);
      else {
        const qtd = formato === "Série" ? Math.min(Number(readValue(form, "temporadas")) || 0, 50) : 0;
        if (qtd) {
          campos.temporadas = qtd;
          campos.partes = Array.from({ length: qtd }, (_, i) => temporadaVazia(i + 1));
        }
        await store.addProjeto(campos);
      }
      avisarMudanca();
    },
  });
}

/* ---------------- Mídia (criar / editar) ---------------- */
export async function abrirNovaMidia(existente = null, { projetoIdFixo = null } = {}) {
  const ed = !!existente;
  const m = existente || {};
  const [listas, projetos, estruturaExistente] = await Promise.all([
    store.getListas(),
    store.listProjetos(),
    ed ? store.estruturaDaMidia(m.id) : Promise.resolve([]),
  ]);
  projetos.sort((a, b) => compararNomes(a.nome, b.nome));
  const itens = projetos.map((p) => ({ value: p.id, label: `${p.nome} (${formatAno(p.ano)})` }));
  const projetoFixo = !ed && projetoIdFixo ? projetos.find((p) => p.id === projetoIdFixo) : null;
  openModal({
    title: ed ? "Editar mídia" : "Nova mídia",
    subtitle: projetoFixo ? `Já vinculada a ${projetoFixo.nome}` : "",
    submitLabel: ed ? "Salvar alterações" : "Criar mídia",
    bodyHtml: `
      ${fieldText("nome", "Nome da mídia", { required: true, value: m.nome || "", placeholder: "Ex.: HD_IMORTAIS_03" })}
      <div class="field-2col">
        ${fieldSelect("tipo", "Tipo", listas.tipoMidia, { value: m.tipo || valorDe(listas.tipoMidia[0]) })}
        ${fieldText("capacidade", "Capacidade (TB)", { type: "number", value: capacidadeParaNumero(m.capacidade), placeholder: "Ex.: 8" })}
      </div>
      <div class="field-2col">
        ${fieldText("usado", "Usado (TB)", { type: "number", value: capacidadeParaNumero(m.usado), placeholder: "Ex.: 6.5", hint: "Espaço já ocupado nesta mídia. Em branco, assume ~90% da capacidade." })}
        ${fieldSelect("statusMidia", "Status", listas.statusMidia, { value: m.statusMidia || (listas.statusMidia.some((s) => s.valor === "Sem atividade") ? "Sem atividade" : listas.statusMidia[0]?.valor) })}
      </div>
      <div class="field-2col">
        ${fieldSelect("local", "Onde está", ["", ...listas.locais], { value: m.local || "" })}
        <div></div>
      </div>
      <div class="field">
        <label>Projetos armazenados</label>
        <div class="field-hint" style="margin-bottom:6px">Marque os projetos e descreva o conteúdo de cada um nesta mídia.</div>
        <div id="proj-conteudo-lista"></div>
      </div>
      <details class="field-details" ${estruturaExistente.length ? "" : "open"}>
        <summary>Estrutura de pastas
          ${estruturaExistente.length ? `<span class="field-details-count">${estruturaExistente.length} cadastrada${estruturaExistente.length > 1 ? "s" : ""}</span>` : ""}
          <span class="muted" style="font-weight:400;font-size:12px">— opcional</span>
        </summary>
        <div class="field-details-body">
          <div class="field-hint" style="margin-bottom:6px">Pastas desta mídia por projeto. Detalhes como resumo e LTO podem ser editados depois na página do projeto.</div>
          <div id="est-lista"></div>
          <button type="button" id="est-add-btn" class="btn btn-ghost" style="width:100%;margin-top:6px;font-size:12px">+ Adicionar pasta</button>
        </div>
      </details>
      ${fieldTextarea("observacoes", "Observações", { value: m.conteudo || "", hint: "Observações gerais sobre esta mídia." })}
    `,
    onMount: (form) => {
      const lista = form.querySelector("#proj-conteudo-lista");
      const marcados = new Set(m.projetosArmazenados || []);
      if (projetoFixo) marcados.add(projetoFixo.id);
      const state = { ...(m.conteudoPorProjeto || {}) };
      // temporadas/versões por projeto (só pra projetos que têm partes)
      const partesState = Object.fromEntries(Object.entries(m.partesPorProjeto || {}).map(([k, v]) => [k, new Set(v)]));
      const partesDoProjeto = Object.fromEntries(projetos.map((p) => [p.id, listaPartes(p)]));
      const estLista = form.querySelector("#est-lista");
      const deletedIds = new Set();

      function projetoOptsHtml(selectedPid) {
        return [...marcados].map((pid) => {
          const it = itens.find((x) => x.value === pid);
          return it ? `<option value="${esc(pid)}" ${pid === selectedPid ? "selected" : ""}>${esc(it.label)}</option>` : "";
        }).join("");
      }
      function tipoOptsHtml(selected) {
        return (listas.tipoMaterial || []).map((t) =>
          `<option value="${esc(t)}" ${t === selected ? "selected" : ""}>${esc(t)}</option>`
        ).join("");
      }

      function atualizarEstProj() {
        estLista.querySelectorAll(".est-proj").forEach((sel) => {
          const cur = sel.value;
          sel.innerHTML = projetoOptsHtml(cur);
          if (!sel.value && marcados.size > 0) sel.value = [...marcados][0];
        });
      }

      function salvarValores() {
        lista.querySelectorAll("input[data-pid]").forEach((inp) => {
          state[inp.dataset.pid] = inp.value;
        });
      }

      function desenhar() {
        salvarValores();
        lista.innerHTML = "";
        itens.forEach((it) => {
          const checked = marcados.has(it.value);
          const row = document.createElement("div");
          row.className = "proj-conteudo-row";
          row.innerHTML = `<label class="proj-cb"><input type="checkbox" name="projetosArmazenados" value="${esc(it.value)}" ${checked ? "checked" : ""}/> ${esc(it.label)}</label>
            ${checked ? `<input type="text" data-pid="${esc(it.value)}" value="${esc(state[it.value] || "")}" placeholder="Conteúdo nesta mídia…" class="proj-conteudo-input" />` : ""}
            ${checked && partesDoProjeto[it.value]?.length ? `<div class="proj-partes">
              <span class="muted">Temporada/versão:</span>
              ${partesDoProjeto[it.value].map((x) => `<label class="proj-parte-cb"><input type="checkbox" data-parte-pid="${esc(it.value)}" value="${esc(x.id)}" ${partesState[it.value]?.has(x.id) ? "checked" : ""}/> ${esc(rotuloParte(x))}</label>`).join("")}
              <span class="muted proj-partes-hint">nenhuma marcada = obra toda</span>
            </div>` : ""}`;
          lista.appendChild(row);
          row.querySelectorAll("input[data-parte-pid]").forEach((cb) => cb.addEventListener("change", () => {
            const pid = cb.dataset.partePid;
            if (!partesState[pid]) partesState[pid] = new Set();
            if (cb.checked) partesState[pid].add(cb.value); else partesState[pid].delete(cb.value);
          }));
          row.querySelector("input[name=projetosArmazenados]").addEventListener("change", (e) => {
            if (e.target.checked) marcados.add(it.value);
            else marcados.delete(it.value);
            desenhar();
          });
        });
        if (!itens.length) {
          lista.innerHTML = '<div class="empty" style="padding:14px">Nenhum projeto cadastrado ainda.</div>';
        }
        atualizarEstProj();
      }
      desenhar();

      form._getProjetosArmazenados = () => [...marcados];
      form._getPartesPorProjeto = () => {
        const result = {};
        marcados.forEach((pid) => {
          const validos = new Set((partesDoProjeto[pid] || []).map((x) => x.id));
          const ids = [...(partesState[pid] || [])].filter((i) => validos.has(i));
          if (ids.length) result[pid] = ids;
        });
        return result;
      };
      form._getConteudoPorProjeto = () => {
        salvarValores();
        const result = {};
        marcados.forEach((pid) => {
          const v = state[pid];
          if (v && v.trim()) result[pid] = v.trim();
        });
        return result;
      };

      function addEstRow({ id = "", projetoId = "", caminho = "", tipoMaterial = "" } = {}) {
        if (!projetoId && marcados.size > 0) projetoId = [...marcados][0];
        if (!tipoMaterial) tipoMaterial = (listas.tipoMaterial || [])[0] || "";
        const row = document.createElement("div");
        row.className = "est-form-row";
        if (id) row.dataset.estId = id;
        row.innerHTML = `
          <div class="est-form-row-top">
            <select class="est-proj">${projetoOptsHtml(projetoId)}</select>
            <button type="button" class="est-del-btn" title="Remover">✕</button>
          </div>
          <input class="est-caminho" type="text" value="${esc(caminho)}" placeholder="Caminho da pasta…" title="${esc(caminho)}">
          <div class="est-form-row-sub">
            <select class="est-tipo">${tipoOptsHtml(tipoMaterial)}</select>
          </div>
        `;
        row.querySelector(".est-del-btn").addEventListener("click", () => {
          if (id) deletedIds.add(id);
          row.remove();
        });
        row.querySelector(".est-caminho").addEventListener("input", (ev) => {
          ev.target.title = ev.target.value;
        });
        estLista.appendChild(row);
      }

      for (const e of estruturaExistente) {
        addEstRow({ id: e.id, projetoId: e.projetoId, caminho: e.caminho, tipoMaterial: e.tipoMaterial });
      }

      form.querySelector("#est-add-btn").addEventListener("click", () => addEstRow());

      form._getEstruturaRows = () => {
        const rows = [];
        estLista.querySelectorAll(".est-form-row").forEach((row) => {
          const cam = row.querySelector(".est-caminho").value.trim();
          if (!cam) return;
          rows.push({
            id: row.dataset.estId || null,
            projetoId: row.querySelector(".est-proj").value,
            caminho: cam,
            tipoMaterial: row.querySelector(".est-tipo").value,
          });
        });
        return rows;
      };
      form._getDeletedEstruturaIds = () => [...deletedIds];
    },
    onSubmit: async (form) => {
      const nome = readValue(form, "nome");
      if (!nome) throw new Error("Informe o nome da mídia.");
      const capacidadeNum = readValue(form, "capacidade");
      const usadoNum = readValue(form, "usado");
      const campos = {
        nome,
        tipo: readValue(form, "tipo"),
        capacidade: capacidadeNum ? `${capacidadeNum}TB` : "",
        usado: usadoNum ? `${usadoNum}TB` : "",
        statusMidia: readValue(form, "statusMidia"),
        local: readValue(form, "local"),
        projetosArmazenados: form._getProjetosArmazenados(),
        conteudo: readValue(form, "observacoes"),
        conteudoPorProjeto: form._getConteudoPorProjeto(),
        partesPorProjeto: form._getPartesPorProjeto(),
      };

      let midiaId;
      if (ed) {
        await store.updateMidia(m.id, campos);
        midiaId = m.id;
      } else {
        const nova = await store.addMidia(campos);
        midiaId = nova.id;
      }

      for (const id of form._getDeletedEstruturaIds()) {
        await store.removeEstrutura(id);
      }
      for (const row of form._getEstruturaRows()) {
        const dadosEst = { projetoId: row.projetoId, midiaId, caminho: row.caminho, tipoMaterial: row.tipoMaterial };
        if (row.id) await store.updateEstrutura(row.id, dadosEst);
        else await store.addEstrutura(dadosEst);
      }

      avisarMudanca();
    },
  });
}

/* ---------------- Estrutura / pasta (criar / editar) ---------------- */
// { projetoIdFixo } → vindo da página do projeto (mostra seletor de mídia)
// { midiaIdFixo }   → vindo da página da mídia  (mostra seletor de projeto)
// existente         → registro a editar (preenche tudo)
export async function abrirNovaEstrutura({ projetoIdFixo = null, midiaIdFixo = null } = {}, existente = null) {
  const [listas, projetos, midias] = await Promise.all([
    store.getListas(), store.listProjetos(), store.listMidias(),
  ]);
  projetos.sort((a, b) => compararNomes(a.nome, b.nome));
  const ed = !!existente;
  const e = existente || {};

  const projetoIdInicial = projetoIdFixo || e.projetoId || projetos[0]?.id;
  const midiaIdInicial = midiaIdFixo || e.midiaId || "";

  // subtitle contextual
  let subtitle = "";
  if (projetoIdFixo) {
    const p = projetos.find((x) => x.id === projetoIdFixo);
    subtitle = ed ? `Estrutura de ${p?.nome}` : `Adicionando à estrutura de ${p?.nome}`;
  } else if (midiaIdFixo) {
    const m = midias.find((x) => x.id === midiaIdFixo);
    subtitle = ed ? `Estrutura de ${m?.nome}` : `Adicionando à ${m?.nome}`;
  }

  // seletor de projeto (se não fixo)
  const seletorProjeto = projetoIdFixo ? "" : (() => {
    const lista = midiaIdFixo
      ? projetos.filter((p) => { const m = midias.find((x) => x.id === midiaIdFixo); return m && (m.projetosArmazenados || []).includes(p.id); })
      : projetos;
    return `<div class="field"><label for="f_projetoId">Projeto</label>
      <select id="f_projetoId" name="projetoId">
        ${lista.map((p) => `<option value="${esc(p.id)}" ${p.id === projetoIdInicial ? "selected" : ""}>${esc(p.nome)} (${formatAno(p.ano)})</option>`).join("")}
      </select></div>`;
  })();

  // seletor de mídia (se não fixo)
  const seletorMidia = midiaIdFixo ? "" : (() => {
    const lista = projetoIdFixo
      ? midias.filter((m) => (m.projetosArmazenados || []).includes(projetoIdFixo))
      : midias;
    return `<div class="field"><label for="f_midiaId">Mídia</label>
      <select id="f_midiaId" name="midiaId">
        <option value="">— Nenhuma —</option>
        ${lista.map((m) => `<option value="${esc(m.id)}" ${m.id === midiaIdInicial ? "selected" : ""}>${esc(m.nome)} (${esc(m.tipo)})</option>`).join("")}
      </select></div>`;
  })();

  openModal({
    title: ed ? "Editar pasta" : "Nova pasta",
    subtitle,
    submitLabel: ed ? "Salvar alterações" : "Adicionar pasta",
    bodyHtml: `
      ${seletorProjeto}
      ${seletorMidia}
      ${fieldText("caminho", "Caminho", { required: true, value: e.caminho || "", placeholder: "Ex.: NOME_DO_HD/BRUTO" })}
      ${fieldSelect("tipoMaterial", "Tipo de material", listas.tipoMaterial, { value: e.tipoMaterial || listas.tipoMaterial[0] })}
      ${fieldText("resumo", "Resumo", { value: e.resumo || "", placeholder: "Ex.: Diárias D01 até D22" })}
      ${fieldText("arquivadoLto", "Arquivado em LTO (opcional)", { value: e.arquivadoLto || "", placeholder: "Ex.: LTO-009" })}
    `,
    onSubmit: async (form) => {
      const caminho = readValue(form, "caminho");
      if (!caminho) throw new Error("Informe o caminho da pasta.");
      const campos = {
        projetoId: projetoIdFixo || readValue(form, "projetoId"),
        midiaId: midiaIdFixo || readValue(form, "midiaId"),
        caminho,
        tipoMaterial: readValue(form, "tipoMaterial"),
        resumo: readValue(form, "resumo"),
        arquivadoLto: readValue(form, "arquivadoLto"),
      };
      if (ed) await store.updateEstrutura(e.id, campos);
      else await store.addEstrutura(campos);
      avisarMudanca();
    },
  });
}

/* ---------------- Histórico (criar / editar) ---------------- */
// projetoIdFixo: trava o seletor quando vem de dentro de um projeto.
// responsavelFixo: trava o seletor quando vem de dentro da aba Equipe.
// existente: registro a editar.
export async function abrirNovoHistorico({ projetoIdFixo = null, responsavelFixo = null } = {}, existente = null) {
  const [listas, projetos] = await Promise.all([store.getListas(), store.listProjetos()]);
  projetos.sort((a, b) => compararNomes(a.nome, b.nome));
  const ed = !!existente;
  const h = existente || {};
  const projetoSel = projetoIdFixo || h.projetoId || "";
  const seletorProjeto = projetoIdFixo
    ? ""
    : `<div class="field"><label for="f_projetoId">Projeto</label>
        <select id="f_projetoId" name="projetoId">
          <option value="">— Geral (sem projeto) —</option>
          ${projetos.map((p) => `<option value="${esc(p.id)}" ${p.id === projetoSel ? "selected" : ""}>${esc(p.nome)} (${formatAno(p.ano)})</option>`).join("")}
        </select></div>`;

  const responsavelSel = responsavelFixo || h.responsavel || "";
  const seletorResponsavel = responsavelFixo
    ? ""
    : `<div class="field"><label for="f_responsavel">Responsável</label>
        <select id="f_responsavel" name="responsavel">
          <option value="">— Sem responsável —</option>
          ${(listas.responsaveis || []).map((r) => `<option value="${esc(r)}" ${r === responsavelSel ? "selected" : ""}>${esc(r)}</option>`).join("")}
        </select></div>`;

  const TIPOS = [
    { k: "dia", label: "Dia" },
    { k: "intervalo", label: "Intervalo" },
    { k: "mes", label: "Mês" },
    { k: "semana", label: "Semana" },
  ];
  const tipoInicial = h.periodoTipo || "dia";

  const subtitlePartes = [];
  if (projetoIdFixo) subtitlePartes.push(projetos.find((p) => p.id === projetoIdFixo)?.nome || "");
  if (responsavelFixo) subtitlePartes.push(responsavelFixo);

  openModal({
    title: ed ? "Editar histórico" : "Novo histórico",
    subtitle: subtitlePartes.length ? `Registro para ${subtitlePartes.join(" · ")}` : "",
    submitLabel: ed ? "Salvar alterações" : "Registrar",
    bodyHtml: `
      ${seletorProjeto}
      ${seletorResponsavel}
      <div class="field">
        <label>Período</label>
        <div class="segmented" data-seg="periodoTipo">
          ${TIPOS.map((t) => `<button type="button" data-k="${t.k}" class="${t.k === tipoInicial ? "active" : ""}">${t.label}</button>`).join("")}
        </div>
      </div>
      <div class="field" id="slot-periodo"></div>
      ${fieldSelect("acao", "Ação", listas.acao, { value: h.acao || listas.acao[0] })}
      ${fieldTextarea("observacoes", "Observações", { value: h.observacoes || "" })}
    `,
    onMount: (form) => {
      let tipo = tipoInicial;
      const slot = form.querySelector("#slot-periodo");
      const seg = form.querySelector('[data-seg="periodoTipo"]');

      function desenhaCampo(valorInicial = "") {
        if (tipo === "dia") {
          const iso = valorInicial && /^\d{4}-\d{2}-\d{2}$/.test(valorInicial)
            ? valorInicial : brParaISO(valorInicial) || hojeISO();
          slot.innerHTML = `<label for="f_periodo">Data</label><input type="date" id="f_periodo" name="periodo" value="${iso}" />`;
        } else {
          const ph = { intervalo: "Ex.: 16–20/06/2026", mes: "Ex.: Junho/2026", semana: "Ex.: Semana 24" }[tipo];
          slot.innerHTML = `<label for="f_periodo">Período (${tipo})</label><input type="text" id="f_periodo" name="periodo" value="${esc(valorInicial)}" placeholder="${ph}" />`;
        }
      }
      // valor inicial: em edição, usa o período salvo
      desenhaCampo(ed ? (tipo === "dia" ? (brParaISO(h.periodo) || h.periodo) : h.periodo) : "");

      seg.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-k]");
        if (!b) return;
        tipo = b.dataset.k;
        seg.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
        desenhaCampo();
      });
      form._getTipo = () => tipo;
    },
    onSubmit: async (form) => {
      const tipo = form._getTipo();
      const raw = readValue(form, "periodo");
      if (!raw) throw new Error("Informe o período.");
      const periodo = tipo === "dia" ? isoParaBR(raw) : raw;
      const data = tipo === "dia" && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : hojeISO();
      const campos = {
        projetoId: projetoIdFixo || readValue(form, "projetoId"),
        responsavel: responsavelFixo || readValue(form, "responsavel"),
        periodoTipo: tipo,
        periodo,
        acao: readValue(form, "acao"),
        observacoes: readValue(form, "observacoes"),
        data,
      };
      if (ed) await store.updateHistorico(h.id, campos);
      else await store.addHistorico(campos);
      avisarMudanca();
    },
  });
}

/* ---------------- Fita (criar / editar) ---------------- */
// campos iguais às colunas da planilha de levantamento; local/tipo/subtipo
// sugerem os valores já usados (datalist), mas aceitam qualquer texto
export async function abrirNovaFita(existente = null) {
  const fitas = await store.listFitas();
  const ed = !!existente;
  const f = existente || {};
  const unicos = (k) => [...new Set(fitas.map((x) => x[k]).filter(Boolean))].sort(compararNomes);
  const lista = (id, k) => `<datalist id="${id}">${unicos(k).map((v) => `<option value="${esc(v)}">`).join("")}</datalist>`;
  const comLista = (html, id) => html.replace("<input ", `<input list="${id}" autocomplete="off" `);
  const masterOpcoes = [
    { valor: "", label: "— (em branco)" }, { valor: "s", label: "Master" },
    { valor: "n/s", label: "Talvez" }, { valor: "n", label: "Não" },
  ];

  openModal({
    title: ed ? "Editar fita" : "Nova fita",
    submitLabel: ed ? "Salvar alterações" : "Cadastrar fita",
    bodyHtml: `
      ${fieldText("nome", "Nome na fita", { required: true, value: f.nome || "" })}
      <div class="field-2col">
        ${comLista(fieldText("tipo", "Tipo", { value: f.tipo || "", placeholder: "Ex.: Betacam" }), "dl-tipo")}
        ${comLista(fieldText("subtipo", "Subtipo", { value: f.subtipo || "", placeholder: "Ex.: 30" }), "dl-sub")}
      </div>
      <div class="field-2col">
        ${comLista(fieldText("local", "Local", { value: f.local || "", placeholder: "Ex.: Armario 6 Prateleira 3" }), "dl-local")}
        <div class="field"><label for="f_master">Master</label>
          <select id="f_master" name="master">
            ${masterOpcoes.map((o) => `<option value="${o.valor}" ${o.valor === (f.master || "") ? "selected" : ""}>${o.label}</option>`).join("")}
          </select></div>
      </div>
      ${fieldText("duracao", "Duração", { value: f.duracao || "", placeholder: "Ex.: 51'44\"" })}
      ${fieldTextarea("obs", "Obs", { value: f.obs || "" })}
      ${lista("dl-tipo", "tipo")}${lista("dl-sub", "subtipo")}${lista("dl-local", "local")}
    `,
    onSubmit: async (form) => {
      const nome = readValue(form, "nome");
      if (!nome) throw new Error("Informe o nome na fita.");
      const campos = {
        nome,
        tipo: readValue(form, "tipo"), subtipo: readValue(form, "subtipo"),
        local: readValue(form, "local"), master: readValue(form, "master"),
        duracao: readValue(form, "duracao"), obs: readValue(form, "obs"),
      };
      if (ed) await store.updateFita(f.id, campos);
      else await store.addFita(campos);
      avisarMudanca();
    },
  });
}

/* ---------------- Pendência (criar / editar) ---------------- */
export async function abrirNovaDemanda(projetoIdFixo = null, existente = null) {
  const [listas, projetos] = await Promise.all([store.getListas(), store.listProjetos()]);
  projetos.sort((a, b) => compararNomes(a.nome, b.nome));
  const ed = !!existente;
  const d = existente || {};
  const projetoSel = projetoIdFixo || d.projetoId || "";
  const seletorProjeto = projetoIdFixo
    ? ""
    : `<div class="field"><label for="f_projetoId">Projeto</label>
        <select id="f_projetoId" name="projetoId">
          <option value="">— Geral (sem projeto) —</option>
          ${projetos.map((p) => `<option value="${esc(p.id)}" ${p.id === projetoSel ? "selected" : ""}>${esc(p.nome)} (${formatAno(p.ano)})</option>`).join("")}
        </select></div>`;

  openModal({
    title: ed ? "Editar pendência" : "Nova pendência",
    subtitle: projetoIdFixo ? `Para ${projetos.find((p) => p.id === projetoIdFixo)?.nome || ""}` : "",
    submitLabel: ed ? "Salvar alterações" : "Criar pendência",
    bodyHtml: `
      ${seletorProjeto}
      ${fieldText("pendencia", "Pendência", { required: true, value: d.pendencia || "", placeholder: "Descreva a tarefa" })}
      <div class="field-2col">
        ${fieldSelect("prioridade", "Prioridade", listas.prioridade, { value: d.prioridade || "Média" })}
        ${fieldSelect("responsavel", "Responsável", listas.responsaveis, { value: d.responsavel || listas.responsaveis[0] })}
      </div>
      ${fieldSelect("status", "Status", listas.statusDemanda, { value: d.status || listas.statusDemanda[0]?.valor })}
    `,
    onSubmit: async (form) => {
      const pendencia = readValue(form, "pendencia");
      if (!pendencia) throw new Error("Descreva a pendência.");
      const campos = {
        projetoId: projetoIdFixo || readValue(form, "projetoId"),
        pendencia,
        prioridade: readValue(form, "prioridade"),
        responsavel: readValue(form, "responsavel"),
        status: readValue(form, "status"),
      };
      if (ed) await store.updateDemanda(d.id, campos);
      else await store.addDemanda(campos);
      avisarMudanca();
    },
  });
}
