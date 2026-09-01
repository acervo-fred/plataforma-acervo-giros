/* ============================================================
   Backend Firestore — implementa a MESMA API do mockStore.
   Projeto giros-imagens, banco Firestore (NÃO o Realtime DB).

   Campos derivados (localizacoes, ultimaAtualizacao) continuam
   calculados no cliente, nunca gravados.
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, getDocsFromServer,
  addDoc, setDoc, updateDoc, deleteDoc, query, where, FieldPath,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig, COLLECTIONS } from "../config/firebase-config.js";
import { listas as listasDefault, organizacaoGlossario as glossarioDefault } from "./mock.js";
import { protocoloZerado, idsFolha } from "./protocolo-arquivamento.js";

const app = initializeApp(firebaseConfig);
const fdb = getFirestore(app);

/* ---------- helpers ---------- */
async function allDocs(coll) {
  const snap = await getDocsFromServer(collection(fdb, coll));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
async function docsWhere(coll, campo, valor) {
  const snap = await getDocsFromServer(query(collection(fdb, coll), where(campo, "==", valor)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function localizacoesDeProjeto(projetoId, midias) {
  return midias.filter((m) => (m.projetosArmazenados || []).includes(projetoId)).map((m) => m.nome);
}
function ultimaAtualizacao(projetoId, historico) {
  const datas = historico.filter((h) => h.projetoId === projetoId && h.data).map((h) => h.data).sort();
  return datas.length ? datas[datas.length - 1] : null;
}
function nomeProjetoOuGeral(projetoId, nomePorId) {
  return projetoId ? (nomePorId[projetoId] || "—") : "Geral";
}

export const firestoreStore = {
  /* LISTAS */
  async getListas() {
    const ref = doc(fdb, COLLECTIONS.config, "listas");
    const snap = await getDoc(ref);
    const stored = snap.exists() ? snap.data() : {};
    return { ...structuredClone(listasDefault), ...stored };
  },
  async saveLista(chave, valores) {
    const ref = doc(fdb, COLLECTIONS.config, "listas");
    await setDoc(ref, { [chave]: valores }, { merge: true });
    return valores;
  },

  /* ORGANIZAÇÃO (herdado do "Avaliação do Acervo") */
  async listGlossario() {
    let itens = await allDocs(COLLECTIONS.organizacaoGlossario);
    if (itens.length === 0) {
      // semeia os termos padrão uma única vez (coleção ainda vazia)
      itens = await Promise.all(glossarioDefault.map(async ({ termo, descricao }) => {
        const ref = await addDoc(collection(fdb, COLLECTIONS.organizacaoGlossario), { termo, descricao });
        return { id: ref.id, termo, descricao };
      }));
    }
    return itens;
  },
  async addGlossarioTermo(termo, descricao) {
    const ref = await addDoc(collection(fdb, COLLECTIONS.organizacaoGlossario), { termo, descricao });
    return { id: ref.id, termo, descricao };
  },
  async removeGlossarioTermo(id) { await deleteDoc(doc(fdb, COLLECTIONS.organizacaoGlossario, id)); return true; },

  async listMetadadosSugestoes() {
    const itens = await allDocs(COLLECTIONS.organizacaoMetadados);
    return itens.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  },
  async addMetadadosSugestao(texto, autor) {
    const novo = { texto, autor, ts: Date.now() };
    const ref = await addDoc(collection(fdb, COLLECTIONS.organizacaoMetadados), novo);
    return { id: ref.id, ...novo };
  },

  async listProjetosFaltantes() {
    const itens = await allDocs(COLLECTIONS.organizacaoProjetosFaltantes);
    return itens.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  },
  async addProjetoFaltante(nome, autor) {
    const novo = { nome, autor, ts: Date.now() };
    const ref = await addDoc(collection(fdb, COLLECTIONS.organizacaoProjetosFaltantes), novo);
    return { id: ref.id, ...novo };
  },

  async getPrioridades() {
    const ref = doc(fdb, COLLECTIONS.config, "organizacaoPrioridades");
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : {};
  },
  async setPrioridade(titulo, campos) {
    const ref = doc(fdb, COLLECTIONS.config, "organizacaoPrioridades");
    const atual = (await getDoc(ref)).data()?.[titulo] || {};
    await setDoc(ref, { [titulo]: { ...atual, ...campos } }, { merge: true });
    return { ...atual, ...campos };
  },

  async getEquipeObservacoes() {
    const ref = doc(fdb, COLLECTIONS.config, "equipeObservacoes");
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : {};
  },
  async setEquipeObservacao(nome, texto) {
    const ref = doc(fdb, COLLECTIONS.config, "equipeObservacoes");
    await setDoc(ref, { [nome]: texto }, { merge: true });
    return texto;
  },

  /* PROJETOS */
  async listProjetos() {
    const [projetos, midias, historico] = await Promise.all([
      allDocs(COLLECTIONS.projetos), allDocs(COLLECTIONS.midias), allDocs(COLLECTIONS.historico),
    ]);
    return projetos.map((p) => ({
      ...p,
      localizacoes: localizacoesDeProjeto(p.id, midias),
      ultimaAtualizacao: ultimaAtualizacao(p.id, historico),
    }));
  },
  async getProjeto(id) {
    const snap = await getDoc(doc(fdb, COLLECTIONS.projetos, id));
    if (!snap.exists()) return null;
    const [midias, historico] = await Promise.all([
      allDocs(COLLECTIONS.midias), docsWhere(COLLECTIONS.historico, "projetoId", id),
    ]);
    const p = { id: snap.id, ...snap.data() };
    return { ...p, localizacoes: localizacoesDeProjeto(id, midias), ultimaAtualizacao: ultimaAtualizacao(id, historico) };
  },

  /* PROTOCOLO DE ARQUIVAMENTO — checklist de organização de pastas */
  async getProtocolo(projetoId) {
    const ref = doc(fdb, COLLECTIONS.projetos, projetoId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const existente = snap.data().protocoloArquivamento;
    if (existente) return existente;
    // projeto anterior a este recurso — inicializa zerado na primeira visita
    const zerado = protocoloZerado();
    await updateDoc(ref, { protocoloArquivamento: zerado });
    return zerado;
  },
  // campo: "created" | "organized". Regra: organized=true força created=true;
  // created=false limpa organized também. Grava só o item tocado (FieldPath,
  // porque os ids como "11.1.1" têm ponto — uma string "a.b.c" seria lida
  // como aninhamento, não como chave literal).
  async setProtocoloItem(projetoId, itemId, campo, valor) {
    const ref = doc(fdb, COLLECTIONS.projetos, projetoId);
    const patch = campo === "organized"
      ? (valor ? { organized: true, created: true } : { organized: false })
      : (valor ? { created: true } : { created: false, organized: false });
    const args = [];
    for (const [k, v] of Object.entries(patch)) {
      args.push(new FieldPath("protocoloArquivamento", itemId, k), v);
    }
    await updateDoc(ref, ...args);
    return true;
  },
  async setProtocoloNota(projetoId, itemId, texto) {
    const ref = doc(fdb, COLLECTIONS.projetos, projetoId);
    await updateDoc(ref, new FieldPath("protocoloArquivamento", itemId, "nota"), texto);
    return true;
  },
  // aplica o mesmo campo/valor (e a mesma regra de negócio) a todo item-folha,
  // numa única escrita
  async setProtocoloTodos(projetoId, campo, valor) {
    const patch = campo === "organized"
      ? (valor ? { organized: true, created: true } : { organized: false })
      : (valor ? { created: true } : { created: false, organized: false });
    const ref = doc(fdb, COLLECTIONS.projetos, projetoId);
    const args = [];
    for (const id of idsFolha()) {
      for (const [k, v] of Object.entries(patch)) {
        args.push(new FieldPath("protocoloArquivamento", id, k), v);
      }
    }
    await updateDoc(ref, ...args);
    return true;
  },

  /* MÍDIAS */
  async listMidias() { return allDocs(COLLECTIONS.midias); },
  async getMidia(id) {
    const snap = await getDoc(doc(fdb, COLLECTIONS.midias, id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },
  async midiasDoProjeto(projetoId) {
    const snap = await getDocs(query(
      collection(fdb, COLLECTIONS.midias), where("projetosArmazenados", "array-contains", projetoId),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  async projetosDaMidia(midiaId) {
    const m = await this.getMidia(midiaId);
    if (!m) return [];
    const cpp = m.conteudoPorProjeto || {};
    const projetos = await allDocs(COLLECTIONS.projetos);
    const porId = Object.fromEntries(projetos.map((p) => [p.id, p]));
    return (m.projetosArmazenados || []).map((pid) => {
      const p = porId[pid];
      return p
        ? { id: p.id, nome: p.nome, ano: p.ano, statusProjeto: p.statusProjeto, existe: true, conteudo: cpp[pid] || "" }
        : { id: pid, nome: "(projeto removido)", ano: "", statusProjeto: null, existe: false, conteudo: cpp[pid] || "" };
    });
  },

  /* ESTRUTURA */
  async estruturaDoProjeto(projetoId) {
    const [pastas, midias] = await Promise.all([
      docsWhere(COLLECTIONS.estrutura, "projetoId", projetoId), allDocs(COLLECTIONS.midias),
    ]);
    const locais = localizacoesDeProjeto(projetoId, midias);
    return pastas.map((e) => ({ ...e, localizacoes: locais }));
  },
  async estruturaDaMidia(midiaId) {
    const [pastas, projetos] = await Promise.all([
      docsWhere(COLLECTIONS.estrutura, "midiaId", midiaId), allDocs(COLLECTIONS.projetos),
    ]);
    const nomePorId = Object.fromEntries(projetos.map((p) => [p.id, p.nome]));
    return pastas.map((e) => ({ ...e, projetoNome: nomePorId[e.projetoId] || "—" }));
  },

  /* HISTÓRICO */
  async historicoDoProjeto(projetoId) {
    const hist = await docsWhere(COLLECTIONS.historico, "projetoId", projetoId);
    return hist.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  },
  async listHistorico() {
    const [historico, projetos] = await Promise.all([
      allDocs(COLLECTIONS.historico), allDocs(COLLECTIONS.projetos),
    ]);
    const nomePorId = Object.fromEntries(projetos.map((p) => [p.id, p.nome]));
    return historico
      .map((h) => ({ ...h, projetoNome: nomeProjetoOuGeral(h.projetoId, nomePorId) }))
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  },

  /* DEMANDAS */
  async demandasDoProjeto(projetoId) { return docsWhere(COLLECTIONS.demandas, "projetoId", projetoId); },
  async listDemandas() {
    const [demandas, projetos] = await Promise.all([
      allDocs(COLLECTIONS.demandas), allDocs(COLLECTIONS.projetos),
    ]);
    const nomePorId = Object.fromEntries(projetos.map((p) => [p.id, p.nome]));
    return demandas.map((d) => ({ ...d, projetoNome: nomeProjetoOuGeral(d.projetoId, nomePorId) }));
  },

  /* FITAS */
  async listFitas() { return allDocs(COLLECTIONS.fitas); },
  async getFita(id) {
    const snap = await getDoc(doc(fdb, COLLECTIONS.fitas, id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },
  async fitasDoProjeto(projetoId) { return docsWhere(COLLECTIONS.fitas, "projetoId", projetoId); },

  /* ---------- ESCRITA ---------- */
  async addProjeto(d) {
    const ref = await addDoc(collection(fdb, COLLECTIONS.projetos), {
      nome: d.nome, ano: d.ano, statusProjeto: d.statusProjeto,
      atividadeAtual: d.atividadeAtual, alfred: d.alfred, lto: d.lto || [],
      protocoloArquivamento: protocoloZerado(),
    });
    return { id: ref.id, ...d };
  },
  async addMidia(d) {
    const ref = await addDoc(collection(fdb, COLLECTIONS.midias), {
      nome: d.nome, tipo: d.tipo, capacidade: d.capacidade || "",
      statusMidia: d.statusMidia, local: d.local || "",
      projetosArmazenados: d.projetosArmazenados || [],
      conteudo: d.conteudo || "", conteudoPorProjeto: d.conteudoPorProjeto || {},
    });
    return { id: ref.id, ...d };
  },
  async addEstrutura(d) {
    const ref = await addDoc(collection(fdb, COLLECTIONS.estrutura), {
      projetoId: d.projetoId, midiaId: d.midiaId || "",
      caminho: d.caminho, tipoMaterial: d.tipoMaterial,
      resumo: d.resumo || "", arquivadoLto: d.arquivadoLto || "",
    });
    return { id: ref.id, ...d };
  },
  async addHistorico(d) {
    const ref = await addDoc(collection(fdb, COLLECTIONS.historico), {
      projetoId: d.projetoId || "", responsavel: d.responsavel || "", periodoTipo: d.periodoTipo, periodo: d.periodo,
      acao: d.acao, observacoes: d.observacoes || "", data: d.data,
    });
    return { id: ref.id, ...d };
  },
  async addDemanda(d) {
    const ref = await addDoc(collection(fdb, COLLECTIONS.demandas), {
      projetoId: d.projetoId || "", pendencia: d.pendencia, prioridade: d.prioridade,
      responsavel: d.responsavel, status: d.status,
    });
    return { id: ref.id, ...d };
  },
  async addFita(d) {
    const ref = await addDoc(collection(fdb, COLLECTIONS.fitas), {
      codigo: d.codigo, tipo: d.tipo, localFisico: d.localFisico || "",
      projetoNome: d.projetoNome || "", projetoId: d.projetoId || "",
      statusFita: d.statusFita, observacoes: d.observacoes || "",
      dataCadastro: d.dataCadastro || new Date().toISOString().slice(0, 10),
    });
    return { id: ref.id, ...d };
  },

  /* ---------- EDIÇÃO ---------- */
  async updateProjeto(id, campos) { await updateDoc(doc(fdb, COLLECTIONS.projetos, id), campos); return { id, ...campos }; },
  async updateMidia(id, campos) { await updateDoc(doc(fdb, COLLECTIONS.midias, id), campos); return { id, ...campos }; },
  async updateEstrutura(id, campos) { await updateDoc(doc(fdb, COLLECTIONS.estrutura, id), campos); return { id, ...campos }; },
  async updateHistorico(id, campos) { await updateDoc(doc(fdb, COLLECTIONS.historico, id), campos); return { id, ...campos }; },
  async updateFita(id, campos) { await updateDoc(doc(fdb, COLLECTIONS.fitas, id), campos); return { id, ...campos }; },
  async updateDemanda(id, campos) { await updateDoc(doc(fdb, COLLECTIONS.demandas, id), campos); return { id, ...campos }; },

  /* ---------- EXCLUSÃO ---------- */
  async removeProjeto(id) {
    const [estr, hist, dem, midias] = await Promise.all([
      docsWhere(COLLECTIONS.estrutura, "projetoId", id),
      docsWhere(COLLECTIONS.historico, "projetoId", id),
      docsWhere(COLLECTIONS.demandas, "projetoId", id),
      this.midiasDoProjeto(id),
    ]);
    await Promise.all([
      ...estr.map((e) => deleteDoc(doc(fdb, COLLECTIONS.estrutura, e.id))),
      ...hist.map((h) => deleteDoc(doc(fdb, COLLECTIONS.historico, h.id))),
      ...dem.map((d) => deleteDoc(doc(fdb, COLLECTIONS.demandas, d.id))),
      ...midias.map((m) => updateDoc(doc(fdb, COLLECTIONS.midias, m.id), {
        projetosArmazenados: (m.projetosArmazenados || []).filter((pid) => pid !== id),
      })),
    ]);
    await deleteDoc(doc(fdb, COLLECTIONS.projetos, id));
    return true;
  },
  async removeMidia(id) { await deleteDoc(doc(fdb, COLLECTIONS.midias, id)); return true; },
  async removeEstrutura(id) { await deleteDoc(doc(fdb, COLLECTIONS.estrutura, id)); return true; },
  async removeHistorico(id) { await deleteDoc(doc(fdb, COLLECTIONS.historico, id)); return true; },
  async removeFita(id) { await deleteDoc(doc(fdb, COLLECTIONS.fitas, id)); return true; },
  async removeDemanda(id) { await deleteDoc(doc(fdb, COLLECTIONS.demandas, id)); return true; },

  /* ---------- BACKUP ---------- */
  async exportAll() {
    const [projetos, midias, estrutura, historico, demandas, fitas, listas] = await Promise.all([
      allDocs(COLLECTIONS.projetos), allDocs(COLLECTIONS.midias), allDocs(COLLECTIONS.estrutura),
      allDocs(COLLECTIONS.historico), allDocs(COLLECTIONS.demandas), allDocs(COLLECTIONS.fitas),
      this.getListas(),
    ]);
    return { projetos, midias, estrutura, historico, demandas, fitas, listas };
  },
  async importAll(data) {
    const grava = async (chaveColl, itens) => {
      if (!Array.isArray(itens)) return;
      for (const item of itens) {
        const { id, ...campos } = item;
        const ref = id ? doc(fdb, chaveColl, id) : doc(collection(fdb, chaveColl));
        await setDoc(ref, campos);
      }
    };
    await grava(COLLECTIONS.projetos, data.projetos);
    await grava(COLLECTIONS.midias, data.midias);
    await grava(COLLECTIONS.estrutura, data.estrutura);
    await grava(COLLECTIONS.historico, data.historico);
    await grava(COLLECTIONS.demandas, data.demandas);
    await grava(COLLECTIONS.fitas, data.fitas);
    if (data.listas) await setDoc(doc(fdb, COLLECTIONS.config, "listas"), data.listas);
  },

  /* ATIVIDADE RECENTE */
  async atividadeRecente(limite = 12) {
    const [projetos, historico, demandas] = await Promise.all([
      allDocs(COLLECTIONS.projetos), allDocs(COLLECTIONS.historico), allDocs(COLLECTIONS.demandas),
    ]);
    const nomePorId = Object.fromEntries(projetos.map((p) => [p.id, p.nome]));
    const hist = historico.map((h) => ({
      tipo: "historico", projetoId: h.projetoId,
      projetoNome: nomeProjetoOuGeral(h.projetoId, nomePorId),
      quando: h.periodo, data: h.data || "",
      texto: `${h.acao} — ${h.observacoes || ""}`.trim(),
    }));
    const dem = demandas.map((d) => ({
      tipo: "demanda", projetoId: d.projetoId,
      projetoNome: nomeProjetoOuGeral(d.projetoId, nomePorId),
      quando: d.status, data: "", texto: d.pendencia,
    }));
    return [...hist, ...dem]
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""))
      .slice(0, limite);
  },
};
