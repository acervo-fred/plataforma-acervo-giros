/* Rastreia a rota (hash) anterior à atual, pra o link "Voltar" de cada
   tela apontar sempre pra página de onde a pessoa realmente veio — e
   não pra um destino fixo (ex.: projeto → sempre lista de projetos).
   Atualizado pelo router (app.js) a cada troca de rota. */

let hashAtual = null;
let hashAnterior = null;

export function registrarRota(hash) {
  hashAnterior = hashAtual;
  hashAtual = hash;
}

// rota anterior, ou o fallback se não houver (ex.: entrou direto nesta
// página por link externo, aba nova ou recarregando o navegador)
export function hashVoltar(fallback) {
  return hashAnterior && hashAnterior !== hashAtual ? hashAnterior : fallback;
}
