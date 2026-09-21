/* Upload de imagem sem backend de arquivos: a foto escolhida é
   redimensionada num <canvas> e vira um data URL (JPEG), pequeno o
   bastante pra caber num campo do próprio documento no Firestore
   (limite de 1MB por documento). Não sobe nada pra lugar nenhum —
   fica gravado junto com o projeto, como texto.

   Comprime progressivamente até caber no limite de segurança; se nem
   assim couber (imagem absurdamente grande/complexa), desiste com um
   erro claro em vez de estourar o limite do Firestore na gravação. */

const LIMITE_SEGURO = 700_000; // ~700KB em base64, sobra margem no doc de 1MB

function carregarImagem(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não consegui ler o arquivo."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Esse arquivo não é uma imagem válida."));
      img.onload = () => resolve(img);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function comprimir(img, maxW, maxH, qualidade) {
  const ratio = Math.min(1, maxW / img.width, maxH / img.height);
  const w = Math.max(1, Math.round(img.width * ratio));
  const h = Math.max(1, Math.round(img.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", qualidade);
}

/* Lê um File de imagem e devolve um data URL JPEG comprimido, pronto
   pra ir num campo do Firestore (ex.: projetos.capa). */
export async function imagemParaDataUrl(file) {
  if (!file.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  const img = await carregarImagem(file);
  // tentativas decrescentes de tamanho/qualidade até caber no limite seguro
  const tentativas = [
    [960, 540, 0.78],
    [960, 540, 0.55],
    [640, 360, 0.6],
    [480, 270, 0.55],
  ];
  let ultimo = "";
  for (const [w, h, q] of tentativas) {
    ultimo = comprimir(img, w, h, q);
    if (ultimo.length <= LIMITE_SEGURO) return ultimo;
  }
  throw new Error("Essa imagem é grande/complexa demais mesmo comprimida. Tente uma foto mais simples ou já num tamanho menor.");
}
