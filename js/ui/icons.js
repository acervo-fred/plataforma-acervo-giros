/* Ícones de linha minimalistas (mesmo estilo dos usados na sidebar,
   inline em index.html) — pra uso em HTML gerado dinamicamente por JS. */

const svg = (paths, size = 13) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px">${paths}</svg>`;

export const iconClock = (size) => svg(`<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`, size);
export const iconAlert = (size) => svg(`<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>`, size);

// foto ilustrativa por tipo de mídia (pasta icones/, servida junto do
// site) — todas em .png com fundo removido (transparente). O ícone de
// cada tipo é escolhido em Configurações → Tipos de mídia (fica salvo
// no próprio item da lista, sobrevive a renomear o tipo); tipo sem
// ícone escolhido cai no genérico.
export function iconeMidia(tipo, listas) {
  const item = (listas?.tipoMidia || []).find(
    (it) => (typeof it === "string" ? it : it.valor) === tipo
  );
  const icone = item && typeof item !== "string" ? item.icone : null;
  return `icones/${icone || "HD outros.png"}`;
}
