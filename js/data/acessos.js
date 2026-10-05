/* Acessos de edição — mesmo esquema do Catálogo Projetos Giros, mas
   só com o papel "editor" (a leitura do Acervo continua livre, sem
   login). A lista de quem pode editar deixou de ser fixa no
   firestore.rules e vive na coleção acervo_authorizedEmails (doc id =
   e-mail), gerenciada pelo admin principal na tela "Acessos"
   (#/acessos). Quem loga sem permissão pode pedir acesso — o pedido
   fica em acervo_accessRequests/{uid} até o admin aprovar/recusar. */

import { getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, getDoc, getDocsFromServer, setDoc, deleteDoc, collection, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const ACERVO_ADMIN = "acervo@girostraffic.page";
const COL_AUTORIZADOS = "acervo_authorizedEmails";
const COL_PEDIDOS = "acervo_accessRequests";

/* Lista fixa que existia no firestore.rules antes da tela de Acessos.
   Usada só (1) pelo botão "Importar lista antiga" e (2) como reserva
   enquanto as regras novas ainda não foram publicadas (a leitura da
   coleção nova dá permission-denied e ninguém perde o acesso). */
export const LISTA_ANTIGA = [
  "gabrielscmiranda@gmail.com",
  "datamanager@girostraffic.page",
  "assistente.extra@girostraffic.page",
  "assistente.principal@girostraffic.page",
  "assistente@giros.com.br",
  "producao.finalizacao@giros.com.br",
];

const fdb = () => getFirestore(getApps()[0]);

export async function emailEhEditor(email) {
  if (!email) return false;
  if (email === ACERVO_ADMIN) return true;
  try {
    const snap = await getDoc(doc(fdb(), COL_AUTORIZADOS, email));
    return snap.exists();
  } catch (err) {
    console.warn("[Acessos] não foi possível verificar o acesso:", err);
    return err.code === "permission-denied" && LISTA_ANTIGA.includes(email);
  }
}

/* ---- pedidos (quem está pedindo) ---- */
export async function pedirAcesso(usuario) {
  await setDoc(doc(fdb(), COL_PEDIDOS, usuario.uid), {
    email: usuario.email,
    nome: usuario.displayName || "",
    criadoEm: serverTimestamp(),
  }, { merge: true });
}
export async function minhaSolicitacao(usuario) {
  try {
    const snap = await getDoc(doc(fdb(), COL_PEDIDOS, usuario.uid));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

/* ---- gestão (só admin) ---- */
export async function listarPedidos() {
  const snap = await getDocsFromServer(collection(fdb(), COL_PEDIDOS));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}
export async function aprovarPedido(pedido, quem) {
  await liberarAcesso(pedido.email, quem);
  await deleteDoc(doc(fdb(), COL_PEDIDOS, pedido.uid));
}
export async function recusarPedido(pedido) {
  await deleteDoc(doc(fdb(), COL_PEDIDOS, pedido.uid));
}
export async function listarAutorizados() {
  const snap = await getDocsFromServer(collection(fdb(), COL_AUTORIZADOS));
  return snap.docs.map((d) => ({ email: d.id, ...d.data() }));
}
export async function liberarAcesso(email, quem) {
  await setDoc(doc(fdb(), COL_AUTORIZADOS, email), {
    email, papel: "editor", liberadoEm: serverTimestamp(), liberadoPor: quem,
  });
}
export async function revogarAcesso(email) {
  await deleteDoc(doc(fdb(), COL_AUTORIZADOS, email));
}
