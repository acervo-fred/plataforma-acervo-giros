/* Capacidade de mídia: o campo `midias.capacidade` é texto livre
   ("3TB", "10 TB", "500GB"), então a soma por projeto precisa
   normalizar tudo para TB antes de comparar. */

const FATOR = { TB: 1, GB: 1 / 1024, MB: 1 / (1024 * 1024), PB: 1024 };

// "3TB" → 3 · "500 GB" → 0.488 · "" → 0
export function parseTB(capacidade) {
  const m = /([\d.,]+)\s*([A-Za-z]*)/.exec(String(capacidade || ""));
  if (!m) return 0;
  const n = parseFloat(m[1].replace(",", ".")) || 0;
  const unidade = (m[2] || "TB").toUpperCase().replace(/B?$/, "B");
  return n * (FATOR[unidade] ?? 1);
}

// number → "8 TB" / "1,5 TB" / "500 GB" (abaixo de 1 TB mostra em GB)
export function fmtTB(n) {
  if (!n) return "0 TB";
  if (n < 1) return `${Math.round(n * 1024)} GB`;
  const txt = Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
  return `${txt} TB`;
}

// soma a capacidade de uma lista de mídias, já formatada
export function somaCapacidade(midias) {
  return fmtTB(midias.reduce((s, m) => s + parseTB(m.capacidade), 0));
}

/* Espaço REALMENTE ocupado numa mídia — `midias.usado` é preenchido
   a partir de agora (mesmo formato livre de `capacidade`, ex. "2.6TB").
   Mídias antigas, cadastradas antes desse campo existir, não têm como
   saber quanto ocupam de verdade — por pedido, assume-se 90% da
   capacidade pra elas até alguém editar com o valor real. */
export function usadoTB(midia) {
  const cap = parseTB(midia.capacidade);
  if (!cap) return 0;
  if (midia.usado) {
    const usado = parseTB(midia.usado);
    if (usado) return Math.min(usado, cap);
  }
  return cap * 0.9;
}

// "2,6 TB de 6 TB" — usado (real ou estimado) sobre a capacidade total
export function fmtUso(midia) {
  const cap = parseTB(midia.capacidade);
  if (!cap) return "—";
  return `${fmtTB(usadoTB(midia))} de ${fmtTB(cap)}`;
}

// soma o espaço realmente ocupado (real ou estimado) de uma lista de mídias
export function somaUsado(midias) {
  return midias.reduce((s, m) => s + usadoTB(m), 0);
}

// Progresso do protocolo de arquivamento a partir do campo bruto do
// projeto (sem inicializar nada no banco — ao contrário de getProtocolo).
// leafs: ids de item-folha (idsFolha()).
export function progressoProtocolo(protocolo, leafs) {
  if (!protocolo) return { iniciado: false, organized: 0, total: leafs.length };
  const organized = leafs.filter((id) => protocolo[id]?.organized).length;
  const created = leafs.filter((id) => protocolo[id]?.created).length;
  return { iniciado: created + organized > 0, organized, total: leafs.length };
}
