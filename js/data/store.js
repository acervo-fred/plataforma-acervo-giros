/* ============================================================
   Store — única fonte de acesso a dados das telas.

   Backend LOCAL (padrão): dados persistidos no localStorage do
   navegador — sobrevivem a recarregar a página, sem nuvem.
   Backend Firestore: opcional, ligado por USE_FIRESTORE.
   Ambos implementam a MESMA API — as telas não mudam.

   Todos os métodos são async de propósito (assim a troca para
   Firestore, que é assíncrono, não altera as views).

   Campos DERIVADOS (nunca gravados): calculados aqui.
   - projeto.localizacoes  ← mídias cujo projetosArmazenados inclui o projeto
   - projeto.ultimaAtualizacao ← data mais recente de histórico/demanda
   - pasta.localizacoes ← herda as localizações do projeto
   ============================================================ */

import * as mock from "./mock.js";
import { USE_FIRESTORE } from "../config/firebase-config.js";

const LS_KEY = "acervo-giros-db-v1";

function estadoInicial() {
  return {
    projetos: structuredClone(mock.projetos),
    midias: structuredClone(mock.midias),
    estrutura: structuredClone(mock.estrutura),
    historico: structuredClone(mock.historico),
    demandas: structuredClone(mock.demandas),
    fitas: structuredClone(mock.fitas),
    testeMidias: [],
    listas: structuredClone(mock.listas),
    organizacao: {
      glossario: structuredClone(mock.organizacaoGlossario),
      metadadosSugestoes: [],
      projetosFaltantes: [],
      prioridades: {}, // { [titulo]: { prioridade, observacao } }
    },
  };
}

/* carrega do localStorage; na 1ª vez, semeia com os dados de exemplo */
function carregar() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Não consegui ler o armazenamento local; usando dados de exemplo.", e);
  }
  return estadoInicial();
}

const db = carregar();
if (!db.fitas) db.fitas = [];
if (!db.testeMidias) db.testeMidias = [];
if (!db.organizacao) {
  db.organizacao = {
    glossario: structuredClone(mock.organizacaoGlossario),
    metadadosSugestoes: [],
    projetosFaltantes: [],
    prioridades: {},
  };
}
if (!db.listas.tipoFita) db.listas.tipoFita = ["Betacam 30", "Betacam 60", "Mini DV"];
if (!db.listas.statusFita) db.listas.statusFita = [
  { valor: "Não catalogada", cor: "gray" },
  { valor: "Catalogada", cor: "blue" },
  { valor: "Aguardando digitalização", cor: "amber" },
  { valor: "Em digitalização", cor: "violet" },
  { valor: "Digitalizada", cor: "green" },
];
if (!db.listas.locaisFita) db.listas.locaisFita = ["Estante A", "Estante B", "Caixa 1", "Caixa 2"];

if (db.fitas.length === 0) {
  const _st = ["Não catalogada","Catalogada","Aguardando digitalização","Em digitalização","Digitalizada"];
  const _loc = db.listas.locaisFita;
  for (let i = 1; i <= 10; i++) {
    const s = i <= 2 ? "Digitalizada" : i <= 4 ? "Em digitalização" : i <= 5 ? "Aguardando digitalização" : _st[Math.floor(Math.random()*2)];
    db.fitas.push({ id:`ft_b30_${i}`, codigo:`BETA30-${String(i).padStart(3,"0")}`, tipo:"Betacam 30", localFisico:_loc[i%_loc.length], projetoNome:"", projetoId:"", statusFita:s, observacoes:"", dataCadastro:"2026-06-25" });
  }
  for (let i = 1; i <= 10; i++) {
    const s = i <= 1 ? "Digitalizada" : i <= 3 ? "Em digitalização" : i <= 4 ? "Aguardando digitalização" : _st[Math.floor(Math.random()*2)];
    db.fitas.push({ id:`ft_b60_${i}`, codigo:`BETA60-${String(i).padStart(3,"0")}`, tipo:"Betacam 60", localFisico:_loc[i%_loc.length], projetoNome:"", projetoId:"", statusFita:s, observacoes:"", dataCadastro:"2026-06-25" });
  }
  for (let i = 1; i <= 10; i++) {
    const s = i <= 1 ? "Digitalizada" : i <= 2 ? "Aguardando digitalização" : _st[Math.floor(Math.random()*2)];
    db.fitas.push({ id:`ft_mdv_${i}`, codigo:`MDV-${String(i).padStart(3,"0")}`, tipo:"Mini DV", localFisico:_loc[i%_loc.length], projetoNome:"", projetoId:"", statusFita:s, observacoes:"", dataCadastro:"2026-06-25" });
  }
  persistir();
}

/* grava o estado atual no localStorage (chamado após cada escrita) */
function persistir() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(db));
  } catch (e) {
    console.warn("Falha ao salvar localmente.", e);
  }
}

/* ---------- helpers de derivação ---------- */

// Mídias que contêm um dado projeto (porta Projeto → Mídias)
function midiasDoProjeto(projetoId) {
  return db.midias.filter((m) => (m.projetosArmazenados || []).includes(projetoId));
}

// Localizações automáticas do projeto = nomes das mídias que o contêm
function localizacoesDoProjeto(projetoId) {
  return midiasDoProjeto(projetoId).map((m) => m.nome);
}

// Última atualização = data mais recente entre históricos e (futuramente) edições
function ultimaAtualizacaoDoProjeto(projetoId) {
  const datas = db.historico
    .filter((h) => h.projetoId === projetoId && h.data)
    .map((h) => h.data)
    .sort();
  return datas.length ? datas[datas.length - 1] : null;
}

// Enriquecer um projeto com seus campos derivados
function enrichProjeto(p) {
  return {
    ...p,
    localizacoes: localizacoesDoProjeto(p.id),
    ultimaAtualizacao: ultimaAtualizacaoDoProjeto(p.id),
  };
}

/* gera um ID local único (no Firestore, o próprio doc.id substitui isto) */
function novoId(prefixo) {
  return `${prefixo}_${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

/* atualiza campos de um item por id; persiste; devolve o item */
function atualizar(colecao, id, campos) {
  const item = colecao.find((x) => x.id === id);
  if (!item) return null;
  Object.assign(item, campos);
  persistir();
  return structuredClone(item);
}

/* remove um item por id; persiste; devolve true/false */
function remover(colecao, id) {
  const i = colecao.findIndex((x) => x.id === id);
  if (i === -1) return false;
  colecao.splice(i, 1);
  persistir();
  return true;
}

/* ---------- API pública (implementação MOCK) ---------- */

const mockStore = {
  /* listas de configuração */
  async getListas() {
    return structuredClone(db.listas);
  },
  // substitui as listas de uma categoria (ex.: "statusProjeto")
  async saveLista(chave, valores) {
    db.listas[chave] = structuredClone(valores);
    persistir();
    return structuredClone(db.listas[chave]);
  },

  /* ORGANIZAÇÃO (herdado do "Avaliação do Acervo") */
  async listGlossario() {
    return structuredClone(db.organizacao.glossario);
  },
  async addGlossarioTermo(termo, descricao) {
    const novo = { id: novoId("gl"), termo, descricao };
    db.organizacao.glossario.push(novo);
    persistir();
    return structuredClone(novo);
  },
  async removeGlossarioTermo(id) { return remover(db.organizacao.glossario, id); },

  async listMetadadosSugestoes() {
    return structuredClone(db.organizacao.metadadosSugestoes).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  },
  async addMetadadosSugestao(texto, autor) {
    const novo = { id: novoId("ms"), texto, autor, ts: Date.now() };
    db.organizacao.metadadosSugestoes.push(novo);
    persistir();
    return structuredClone(novo);
  },

  async listProjetosFaltantes() {
    return structuredClone(db.organizacao.projetosFaltantes).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  },
  async addProjetoFaltante(nome, autor) {
    const novo = { id: novoId("pf"), nome, autor, ts: Date.now() };
    db.organizacao.projetosFaltantes.push(novo);
    persistir();
    return structuredClone(novo);
  },

  async getPrioridades() { return structuredClone(db.organizacao.prioridades); },
  async setPrioridade(titulo, campos) {
    db.organizacao.prioridades[titulo] = { ...(db.organizacao.prioridades[titulo] || {}), ...campos };
    persistir();
    return structuredClone(db.organizacao.prioridades[titulo]);
  },

  /* PROJETOS */
  async listProjetos() {
    return db.projetos.map(enrichProjeto);
  },
  async getProjeto(id) {
    const p = db.projetos.find((x) => x.id === id);
    return p ? enrichProjeto(p) : null;
  },

  /* MÍDIAS */
  async listMidias() {
    return structuredClone(db.midias);
  },
  async getMidia(id) {
    const m = db.midias.find((x) => x.id === id);
    return m ? structuredClone(m) : null;
  },
  // porta Projeto → Mídias
  async midiasDoProjeto(projetoId) {
    return midiasDoProjeto(projetoId);
  },
  // porta Mídia → Projetos: resumo de cada projeto contido (com status p/ cor)
  async projetosDaMidia(midiaId) {
    const m = db.midias.find((x) => x.id === midiaId);
    if (!m) return [];
    const cpp = m.conteudoPorProjeto || {};
    return (m.projetosArmazenados || []).map((pid) => {
      const p = db.projetos.find((x) => x.id === pid);
      return p
        ? { id: p.id, nome: p.nome, ano: p.ano, statusProjeto: p.statusProjeto, existe: true, conteudo: cpp[pid] || "" }
        : { id: pid, nome: "(projeto removido)", ano: "", statusProjeto: null, existe: false, conteudo: cpp[pid] || "" };
    });
  },

  /* ESTRUTURA (pastas) — localizações herdam do projeto */
  async estruturaDoProjeto(projetoId) {
    const locais = localizacoesDoProjeto(projetoId);
    return db.estrutura
      .filter((e) => e.projetoId === projetoId)
      .map((e) => ({ ...e, localizacoes: locais }));
  },

  /* ESTRUTURA de uma mídia */
  async estruturaDaMidia(midiaId) {
    const nomePorId = Object.fromEntries(db.projetos.map((p) => [p.id, p.nome]));
    return db.estrutura
      .filter((e) => e.midiaId === midiaId)
      .map((e) => ({ ...e, projetoNome: nomePorId[e.projetoId] || "—" }));
  },

  /* HISTÓRICO */
  async historicoDoProjeto(projetoId) {
    return db.historico
      .filter((h) => h.projetoId === projetoId)
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  },

  /* DEMANDAS */
  async demandasDoProjeto(projetoId) {
    return db.demandas.filter((d) => d.projetoId === projetoId);
  },
  async listDemandas() {
    const nomePorId = Object.fromEntries(db.projetos.map((p) => [p.id, p.nome]));
    return db.demandas.map((d) => ({ ...d, projetoNome: d.projetoId ? (nomePorId[d.projetoId] || "—") : "Geral" }));
  },

  /* HISTÓRICO global (todas as entradas, com nome do projeto, recente→antigo) */
  async listHistorico() {
    const nomePorId = Object.fromEntries(db.projetos.map((p) => [p.id, p.nome]));
    return db.historico
      .map((h) => ({ ...h, projetoNome: h.projetoId ? (nomePorId[h.projetoId] || "—") : "Geral" }))
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  },

  /* FITAS */
  async listFitas() {
    return structuredClone(db.fitas);
  },
  async getFita(id) {
    const f = db.fitas.find((x) => x.id === id);
    return f ? structuredClone(f) : null;
  },
  async fitasDoProjeto(projetoId) {
    return db.fitas.filter((f) => f.projetoId === projetoId).map((f) => structuredClone(f));
  },

  /* TESTE MÍDIAS (aba experimental, isolada das outras coleções) */
  async listTesteMidias() {
    return structuredClone(db.testeMidias);
  },
  async addTesteMidiasLote(itens) {
    const novos = itens.map((it) => ({
      id: novoId("tm"),
      caminho: it.caminho,
      conteudo: it.conteudo || "",
      origem: it.origem || "",
      criadoEm: new Date().toISOString().slice(0, 10),
    }));
    db.testeMidias.push(...novos);
    persistir();
    return novos.map((n) => structuredClone(n));
  },
  async updateTesteMidia(id, campos) { return atualizar(db.testeMidias, id, campos); },
  async removeTesteMidia(id) { return remover(db.testeMidias, id); },

  /* ---------- ESCRITA (grava no localStorage) ---------- */
  async addProjeto(dados) {
    const novo = {
      id: novoId("p"),
      nome: dados.nome,
      ano: dados.ano,
      statusProjeto: dados.statusProjeto,
      atividadeAtual: dados.atividadeAtual,
      alfred: dados.alfred,
      lto: dados.lto || [],
    };
    db.projetos.push(novo);
    persistir();
    return enrichProjeto(novo);
  },
  async addMidia(dados) {
    const novo = {
      id: novoId("m"),
      nome: dados.nome,
      tipo: dados.tipo,
      capacidade: dados.capacidade || "",
      statusMidia: dados.statusMidia,
      local: dados.local || "",
      projetosArmazenados: dados.projetosArmazenados || [],
      conteudo: dados.conteudo || "",
      conteudoPorProjeto: dados.conteudoPorProjeto || {},
    };
    db.midias.push(novo);
    persistir();
    return structuredClone(novo);
  },
  async addEstrutura(dados) {
    const novo = {
      id: novoId("e"),
      projetoId: dados.projetoId,
      midiaId: dados.midiaId || "",
      caminho: dados.caminho,
      tipoMaterial: dados.tipoMaterial,
      resumo: dados.resumo || "",
      statusPasta: dados.statusPasta,
      arquivadoLto: dados.arquivadoLto || "",
    };
    db.estrutura.push(novo);
    persistir();
    return structuredClone(novo);
  },
  async addHistorico(dados) {
    const novo = {
      id: novoId("h"),
      projetoId: dados.projetoId,
      periodoTipo: dados.periodoTipo,
      periodo: dados.periodo,
      acao: dados.acao,
      observacoes: dados.observacoes || "",
      data: dados.data, // chave ISO p/ ordenar recência
    };
    db.historico.push(novo);
    persistir();
    return structuredClone(novo);
  },
  async addFita(dados) {
    const novo = {
      id: novoId("ft"),
      codigo: dados.codigo,
      tipo: dados.tipo,
      localFisico: dados.localFisico || "",
      projetoNome: dados.projetoNome || "",
      projetoId: dados.projetoId || "",
      statusFita: dados.statusFita,
      observacoes: dados.observacoes || "",
      dataCadastro: dados.dataCadastro || new Date().toISOString().slice(0, 10),
    };
    db.fitas.push(novo);
    persistir();
    return structuredClone(novo);
  },
  async addDemanda(dados) {
    const novo = {
      id: novoId("d"),
      projetoId: dados.projetoId,
      pendencia: dados.pendencia,
      prioridade: dados.prioridade,
      responsavel: dados.responsavel,
      status: dados.status,
    };
    db.demandas.push(novo);
    persistir();
    return structuredClone(novo);
  },

  /* ---------- EDIÇÃO (atualiza campos por id) ---------- */
  async updateProjeto(id, campos) { return atualizar(db.projetos, id, campos); },
  async updateMidia(id, campos) { return atualizar(db.midias, id, campos); },
  async updateEstrutura(id, campos) { return atualizar(db.estrutura, id, campos); },
  async updateHistorico(id, campos) { return atualizar(db.historico, id, campos); },
  async updateFita(id, campos) { return atualizar(db.fitas, id, campos); },
  async updateDemanda(id, campos) { return atualizar(db.demandas, id, campos); },

  /* ---------- EXCLUSÃO (remove por id) ---------- */
  async removeProjeto(id) {
    // limpa também o que dependia do projeto, e tira o id das mídias
    db.estrutura = db.estrutura.filter((e) => e.projetoId !== id);
    db.historico = db.historico.filter((h) => h.projetoId !== id);
    db.demandas = db.demandas.filter((d) => d.projetoId !== id);
    db.midias.forEach((m) => {
      if (m.projetosArmazenados) m.projetosArmazenados = m.projetosArmazenados.filter((pid) => pid !== id);
    });
    return remover(db.projetos, id);
  },
  async removeMidia(id) { return remover(db.midias, id); },
  async removeEstrutura(id) { return remover(db.estrutura, id); },
  async removeHistorico(id) { return remover(db.historico, id); },
  async removeFita(id) { return remover(db.fitas, id); },
  async removeDemanda(id) { return remover(db.demandas, id); },

  /* ---------- BACKUP (export / import) ---------- */
  async exportAll() {
    return structuredClone({
      projetos: db.projetos, midias: db.midias, estrutura: db.estrutura,
      historico: db.historico, demandas: db.demandas, fitas: db.fitas,
      listas: db.listas,
    });
  },
  async importAll(data) {
    ["projetos", "midias", "estrutura", "historico", "demandas", "fitas"].forEach((k) => {
      if (Array.isArray(data[k])) db[k] = structuredClone(data[k]);
    });
    if (data.listas) db.listas = structuredClone(data.listas);
    persistir();
  },

  /* ATIVIDADE RECENTE (home) — históricos + demandas de todos os projetos */
  async atividadeRecente(limite = 12) {
    const nomePorId = Object.fromEntries(db.projetos.map((p) => [p.id, p.nome]));
    const hist = db.historico.map((h) => ({
      tipo: "historico",
      projetoId: h.projetoId,
      projetoNome: h.projetoId ? (nomePorId[h.projetoId] || "—") : "Geral",
      quando: h.periodo,
      data: h.data || "",
      texto: `${h.acao} — ${h.observacoes || ""}`.trim(),
    }));
    const dem = db.demandas.map((d) => ({
      tipo: "demanda",
      projetoId: d.projetoId,
      projetoNome: d.projetoId ? (nomePorId[d.projetoId] || "—") : "Geral",
      quando: d.status,
      data: "",
      texto: d.pendencia,
    }));
    return [...hist, ...dem]
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""))
      .slice(0, limite);
  },
};

/* ---------- Seleção de backend ----------
   USE_FIRESTORE=false → mock em memória (acima).
   USE_FIRESTORE=true  → importa o backend Firestore dinamicamente
   (assim o SDK do Firebase só é baixado quando realmente usado).
   Os dois objetos implementam a MESMA API — as telas não mudam. */
let store = mockStore;
if (USE_FIRESTORE) {
  try {
    const mod = await import("./firestore.js");
    store = mod.firestoreStore;
    console.info("Usando Firestore como backend.");
  } catch (e) {
    console.warn("Firestore indisponível — usando localStorage como fallback.", e);
  }
}

export { store };
