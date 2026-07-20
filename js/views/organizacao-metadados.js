/* Sugestão de Metadados — igual ao "Avaliação do Acervo": campo livre
   pra sugerir o que registrar sobre cada projeto (ano, diretor, tema,
   formato original, palavras-chave...), visível pra todo mundo. */

import { store } from "../data/store.js";
import { esc } from "../ui/dom.js";

function tempoRelativo(ts) {
  if (!ts) return "";
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export async function renderMetadados(cont) {
  cont.innerHTML = `
    <p class="page-sub" style="margin-bottom:18px">
      Além da descrição visual que será feita, o que mais você acha importante registrar
      pra encontrar um projeto facilmente? Ano, diretor, tema, formato original, palavras-chave?
      As sugestões ficam salvas e visíveis pra todo mundo.
    </p>
    <div class="sug-form">
      <div class="field-2col">
        <div class="field"><label for="sug-autor">Seu nome</label><input class="input" type="text" id="sug-autor" /></div>
      </div>
      <div class="field">
        <label for="sug-texto">Sugestão</label>
        <textarea class="input" id="sug-texto" rows="3" placeholder="Ex.: incluir nome do diretor, ano de produção, formato original da fita…"></textarea>
      </div>
      <button class="btn btn-primary" id="btn-enviar-sugestao">Enviar sugestão</button>
    </div>
    <div class="sug-feed" id="sug-feed" style="margin-top:20px"></div>
  `;

  const feed = cont.querySelector("#sug-feed");

  function desenhar(itens) {
    feed.innerHTML = itens.length
      ? itens.map((s) => `
        <div class="sug-item">
          <div class="sug-item-head">
            <strong>${esc(s.autor || "Anônimo")}</strong>
            <span class="muted">${esc(tempoRelativo(s.ts))}</span>
          </div>
          <div class="sug-item-texto">${esc(s.texto)}</div>
        </div>`).join("")
      : `<div class="empty">Nenhuma sugestão ainda.</div>`;
  }

  const itens = await store.listMetadadosSugestoes();
  desenhar(itens);

  cont.querySelector("#btn-enviar-sugestao").addEventListener("click", async () => {
    const autorEl = cont.querySelector("#sug-autor");
    const textoEl = cont.querySelector("#sug-texto");
    const texto = textoEl.value.trim();
    if (!texto) { alert("Escreva sua sugestão antes de enviar."); return; }
    const nova = await store.addMetadadosSugestao(texto, autorEl.value.trim());
    itens.unshift(nova);
    desenhar(itens);
    textoEl.value = "";
  });
}
