/* Ícones de linha minimalistas (mesmo estilo dos usados na sidebar,
   inline em index.html) — pra uso em HTML gerado dinamicamente por JS. */

const svg = (paths, size = 13) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px">${paths}</svg>`;

export const iconClock = (size) => svg(`<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`, size);
export const iconAlert = (size) => svg(`<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`, size);
