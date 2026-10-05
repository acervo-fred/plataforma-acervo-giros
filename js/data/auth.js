/* Login com Google (Firebase Auth) — mesmo projeto Firebase do
   Firestore (giros-imagens). Leitura continua livre; escrita exige
   uma conta liberada na tela "Acessos" (coleção acervo_authorizedEmails,
   ver js/data/acessos.js) — e a regra do Firestore confere a mesma
   coleção. Esse módulo cuida da sessão + de saber se ela pode editar;
   quem barra de verdade é a regra do servidor. */

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "../config/firebase-config.js";
import { emailEhEditor, ACERVO_ADMIN } from "./acessos.js";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

// os assinantes só são avisados depois de saber se a sessão pode
// editar — assim nenhuma tela desenha botões de edição antes da hora
let _usuario = null;
let _editor = false;
let _pronto = false;
const _assinantes = new Set();

onAuthStateChanged(auth, async (usuario) => {
  const editor = usuario ? await emailEhEditor(usuario.email) : false;
  _usuario = usuario;
  _editor = editor;
  _pronto = true;
  _assinantes.forEach((cb) => cb(usuario));
});

export function usuarioAtual() {
  return auth.currentUser;
}

/* logado E liberado em Acessos (ou admin principal) */
export function usuarioEditor() {
  return !!(auth.currentUser && _editor);
}

export function usuarioAdmin() {
  return !!(auth.currentUser && auth.currentUser.email === ACERVO_ADMIN);
}

export function onAuthChange(callback) {
  _assinantes.add(callback);
  // assíncrono de propósito: quem chama pode precisar do retorno
  // (unsub) dentro do próprio callback
  if (_pronto) queueMicrotask(() => { if (_assinantes.has(callback)) callback(_usuario); });
  return () => _assinantes.delete(callback);
}

export async function loginComGoogle() {
  await signInWithPopup(auth, new GoogleAuthProvider());
}

export async function logout() {
  await signOut(auth);
}
