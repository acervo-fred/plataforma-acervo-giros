/* Lista de todos os arquivos de uma mídia — escaneia a mídia externa
   conectada (File System Access API, mesmo mecanismo do seletor de
   pastas) e gera um texto em árvore com pastas e subpastas, mostrando
   só o nome de cada arquivo (sem caminho completo). O texto gerado
   fica salvo no próprio registro da mídia; quem chama decide onde
   guardar e também pode baixar como .txt.

   O documento da mídia mora no Firestore, que tem um limite rígido de
   1MB por documento — ver TAMANHO_SEGURO_FIRESTORE, usado por quem
   chama pra decidir se ainda cabe salvar o texto lá ou só baixar. */

import { compararNomes } from "./dom.js";

const LIMITE_ITENS = 60000;
// pastas sempre entram na lista inteiras; arquivos individuais menores
// que este tamanho podem ser omitidos (opção minBytes), pra encurtar
// listas de mídias com muitos arquivos pequenos (proxies, sequências
// de frames etc.) sem perder a estrutura de pastas
const IGNORAR = new Set([
  "$RECYCLE.BIN", "System Volume Information", ".Trashes", ".fseventsd",
  ".Spotlight-V100", ".TemporaryItems", ".DocumentRevisions-V100", ".apdisk",
]);

// margem de segurança abaixo do limite de 1.048.576 bytes por documento
// do Firestore (sobra espaço pros outros campos da mídia)
export const TAMANHO_SEGURO_FIRESTORE = 900_000;

async function escanear(dirHandle, profundidade, linhas, contador, stats, minBytes) {
  if (contador.n >= LIMITE_ITENS) return;
  const entradas = [];
  for await (const handle of dirHandle.values()) {
    if (handle.name.startsWith(".") || IGNORAR.has(handle.name)) continue;
    entradas.push(handle);
  }
  entradas.sort((a, b) =>
    a.kind === b.kind ? compararNomes(a.name, b.name) : (a.kind === "directory" ? -1 : 1));

  const indent = "  ".repeat(profundidade);
  for (const handle of entradas) {
    if (contador.n >= LIMITE_ITENS) break;
    contador.n++;
    if (handle.kind === "directory") {
      stats.pastas++;
      linhas.push(`${indent}${handle.name}/`);
      await escanear(handle, profundidade + 1, linhas, contador, stats, minBytes);
    } else if (minBytes > 0) {
      const arquivo = await handle.getFile();
      if (arquivo.size < minBytes) { stats.ignorados++; continue; }
      stats.arquivos++;
      linhas.push(`${indent}${handle.name}`);
    } else {
      stats.arquivos++;
      linhas.push(`${indent}${handle.name}`);
    }
  }
}

/* Abre o seletor de pasta/mídia externa e devolve a lista em texto
   (árvore, com indentação por nível). Devolve null se a pessoa
   cancelou a escolha da pasta.
   opts.minBytes: arquivos menores que isso não entram na lista (as
   pastas continuam todas, intactas) — 0 desliga o filtro (padrão). */
export async function gerarListaArquivos({ minBytes = 0 } = {}) {
  let dirHandle;
  try {
    dirHandle = await window.showDirectoryPicker();
  } catch {
    return null;
  }
  const linhas = [`${dirHandle.name}/`];
  const contador = { n: 1 };
  const stats = { arquivos: 0, pastas: 0, ignorados: 0 };
  await escanear(dirHandle, 1, linhas, contador, stats, minBytes);
  const texto = linhas.join("\n");
  return {
    texto,
    raiz: dirHandle.name,
    arquivos: stats.arquivos,
    pastas: stats.pastas,
    ignorados: stats.ignorados,
    truncado: contador.n >= LIMITE_ITENS,
    grandeDemaisPraSalvar: new Blob([texto]).size > TAMANHO_SEGURO_FIRESTORE,
  };
}

// dispara o download de um .txt no navegador
export function baixarTxt(nomeArquivo, conteudo) {
  const nome = nomeArquivo.replace(/[\\/:*?"<>|]+/g, "-");
  const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}
