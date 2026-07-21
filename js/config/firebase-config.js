/* ============================================================
   Configuração do Firebase
   ------------------------------------------------------------
   Projeto: giros-imagens (MESMO projeto da ferramenta anterior).
   Banco usado por NÓS: Firestore.

   ⚠️ O Realtime Database existente NÃO é tocado: este código só
   inicializa o Firestore (getFirestore). Nunca chamamos
   getDatabase(), então o RTDB da outra ferramenta fica intacto.

   Coleções com prefixo "acervo_" para isolar de qualquer outro
   uso do Firestore no mesmo projeto.

   Para ATIVAR o Firestore e popular os dados iniciais, veja
   docs/firebase-setup.md.
   ============================================================ */

// Backend de dados.
//  false → modo LOCAL (localStorage do navegador) — dados ficam
//          salvos na máquina, sobrevivem a recarregar a página.
//          É o modo atual de desenvolvimento.
//  true  → Firestore (giros-imagens). Deixado pronto e desligado;
//          só usar quando quiser sincronizar entre dispositivos.
export const USE_FIRESTORE = true;

export const firebaseConfig = {
  apiKey: "AIzaSyC-0iuPs5xhvjjh2LmzoGjAKtAh6aY2-ZQ",
  authDomain: "giros-imagens.firebaseapp.com",
  projectId: "giros-imagens",
  storageBucket: "giros-imagens.firebasestorage.app",
  messagingSenderId: "623464708019",
  appId: "1:623464708019:web:94aa710dd5b3a566a5bdc6",
  measurementId: "G-8LN25ZZGP5",
  // databaseURL do RTDB existe no projeto, mas NÃO é incluída aqui
  // de propósito — não usamos Realtime Database.
};

/* Nomes das coleções (Firestore) + doc único de listas. */
export const COLLECTIONS = {
  projetos: "acervo_projetos",
  midias: "acervo_midias",
  estrutura: "acervo_estrutura",
  historico: "acervo_historico",
  demandas: "acervo_demandas",
  fitas: "acervo_fitas",
  config: "acervo_config", // docs "listas" e "organizacaoPrioridades"
  organizacaoGlossario: "acervo_organizacaoGlossario",
  organizacaoMetadados: "acervo_organizacaoMetadados",
  organizacaoProjetosFaltantes: "acervo_organizacaoProjetosFaltantes",
};
