import { usuarioAtual } from "../data/auth.js";

const NB_KEY = "acervo-giros-caderno-html";
const NB_KEY_OLD = "acervo-giros-caderno";

export function renderCaderno(app) {
  const podeEditar = !!usuarioAtual();
  let salvo = localStorage.getItem(NB_KEY);
  if (!salvo) {
    const old = localStorage.getItem(NB_KEY_OLD);
    if (old) salvo = old.replace(/\n/g, "<br>");
  }
  salvo = salvo || "";

  app.innerHTML = `
    <div class="page-sub" style="margin-bottom:14px">Anotações livres — salvas automaticamente neste navegador</div>
    <div class="caderno-wrap">
      <div class="caderno-toolbar edit-only" id="caderno-tb">
        <button type="button" data-cmd="bold" title="Negrito (Ctrl+B)"><b>N</b></button>
        <button type="button" data-cmd="italic" title="Itálico (Ctrl+I)"><i>I</i></button>
        <button type="button" data-cmd="underline" title="Sublinhado (Ctrl+U)"><u>S</u></button>
        <button type="button" data-cmd="strikeThrough" title="Riscado"><s>R</s></button>
        <span class="caderno-sep"></span>
        <button type="button" data-cmd="insertUnorderedList" title="Lista">•</button>
        <button type="button" data-cmd="insertOrderedList" title="Lista numerada">1.</button>
        <span class="caderno-sep"></span>
        <button type="button" data-block="h2" title="Título">T</button>
        <button type="button" data-block="h3" title="Subtítulo">t</button>
        <button type="button" data-block="p" title="Parágrafo normal">¶</button>
      </div>
      <div id="caderno-editor" class="caderno-editor" contenteditable="${podeEditar}">${salvo}</div>
    </div>
  `;

  const editor = app.querySelector("#caderno-editor");
  const tb = app.querySelector("#caderno-tb");

  editor.addEventListener("input", () => {
    localStorage.setItem(NB_KEY, editor.innerHTML);
  });

  tb.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cmd]");
    const blk = e.target.closest("[data-block]");
    if (btn) {
      document.execCommand(btn.dataset.cmd, false, null);
      editor.focus();
    } else if (blk) {
      document.execCommand("formatBlock", false, blk.dataset.block);
      editor.focus();
    }
  });

  editor.focus();
}
