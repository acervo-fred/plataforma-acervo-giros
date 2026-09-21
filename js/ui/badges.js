/* Helpers de badge: dado um valor de status e a lista correspondente
   (que carrega a cor de cada valor), devolve o HTML do badge.
   Se o valor não estiver na lista, cai para cinza. */

import { esc } from "./dom.js";

// Acha a cor de um valor dentro de uma lista de {valor, cor}
export function corDoValor(lista, valor, fallback = "gray") {
  if (!Array.isArray(lista)) return fallback;
  const item = lista.find((x) => (typeof x === "string" ? x : x.valor) === valor);
  return item && typeof item === "object" ? item.cor || fallback : fallback;
}

// HTML de um badge colorido
export function badge(valor, cor = "gray") {
  if (!valor) return "";
  return `<span class="badge badge--${esc(cor)}">${esc(valor)}</span>`;
}

// Badge a partir de uma lista de configuração
export function badgeFromLista(lista, valor, fallback = "gray") {
  return badge(valor, corDoValor(lista, valor, fallback));
}

/* Chips clicáveis de projeto — usados nas telas de Mídias (lista e
   detalhe) pra resolver `midias.projetosArmazenados` (só ids) nos nomes
   dos projetos. O join é no cliente: o Firestore não tem relação nativa.

   ids: string[]  ·  nomePorId: { [id]: nome }
   max: quantos aparecem antes de virar "+N" (0 = todos). */
export function chipsProjetos(ids = [], nomePorId = {}, { max = 2 } = {}) {
  if (!ids.length) return `<span class="muted" style="font-size:12.5px">—</span>`;
  const mostrar = max > 0 ? ids.slice(0, max) : ids;
  const resto = ids.length - mostrar.length;
  const chips = mostrar.map((id) => {
    const nome = nomePorId[id];
    return nome
      ? `<a class="proj-chip" href="#/projeto/${esc(id)}" title="${esc(nome)}">${esc(nome)}</a>`
      : `<span class="proj-chip proj-chip--orfao" title="Projeto ${esc(id)} não encontrado">projeto removido</span>`;
  });
  if (resto > 0) {
    const nomesResto = ids.slice(mostrar.length).map((id) => nomePorId[id] || "?").join(", ");
    chips.push(`<span class="proj-chip proj-chip--mais" title="${esc(nomesResto)}">+${resto}</span>`);
  }
  return `<span class="proj-chips">${chips.join("")}</span>`;
}
