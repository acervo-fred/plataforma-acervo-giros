/* Lista de todos os arquivos de uma mídia — escaneia a mídia externa
   conectada (File System Access API, mesmo mecanismo do seletor de
   pastas) e gera um texto em árvore com pastas e subpastas, mostrando
   só o nome de cada arquivo (sem caminho completo). O texto gerado
   fica salvo no próprio registro da mídia; quem chama decide onde
   guardar e também pode baixar como .txt. */

const LIMITE_ITENS = 20000;
const IGNORAR = new Set([
  "$RECYCLE.BIN", "System Volume Information", ".Trashes", ".fseventsd",
  ".Spotlight-V100", ".TemporaryItems", ".DocumentRevisions-V100", ".apdisk",
]);

async function escanear(dirHandle, profundidade, linhas, contador, stats) {
  if (contador.n >= LIMITE_ITENS) return;
  const entradas = [];
  for await (const handle of dirHandle.values()) {
    if (handle.name.startsWith(".") || IGNORAR.has(handle.name)) continue;
    entradas.push(handle);
  }
  entradas.sort((a, b) =>
    a.kind === b.kind ? a.name.localeCompare(b.name, "pt-BR") : (a.kind === "directory" ? -1 : 1));

  const indent = "  ".repeat(profundidade);
  for (const handle of entradas) {
    if (contador.n >= LIMITE_ITENS) break;
    contador.n++;
    if (handle.kind === "directory") {
      stats.pastas++;
      linhas.push(`${indent}${handle.name}/`);
      await escanear(handle, profundidade + 1, linhas, contador, stats);
    } else {
      stats.arquivos++;
      linhas.push(`${indent}${handle.name}`);
    }
  }
}

/* Abre o seletor de pasta/mídia externa e devolve a lista em texto
   (árvore, com indentação por nível). Devolve null se a pessoa
   cancelou a escolha da pasta. */
export async function gerarListaArquivos() {
  let dirHandle;
  try {
    dirHandle = await window.showDirectoryPicker();
  } catch {
    return null;
  }
  const linhas = [`${dirHandle.name}/`];
  const contador = { n: 1 };
  const stats = { arquivos: 0, pastas: 0 };
  await escanear(dirHandle, 1, linhas, contador, stats);
  return {
    texto: linhas.join("\n"),
    raiz: dirHandle.name,
    arquivos: stats.arquivos,
    pastas: stats.pastas,
    truncado: contador.n >= LIMITE_ITENS,
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
