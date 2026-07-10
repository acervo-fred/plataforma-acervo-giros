/* Pequenos utilitários de DOM (sem framework). */

// Escapa texto para inserção segura via innerHTML
export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Formata o ano do projeto p/ exibição — 1900 é o valor placeholder de "não informado"
export function formatAno(ano) {
  if (ano === 1900 || ano === "1900" || ano == null || ano === "") return "Ano não informado";
  return String(ano);
}

// Cria um elemento a partir de uma string HTML (1 nó raiz)
export function html(strings, ...values) {
  const str = Array.isArray(strings)
    ? strings.reduce((acc, s, i) => acc + s + (values[i] ?? ""), "")
    : String(strings);
  const tpl = document.createElement("template");
  tpl.innerHTML = str.trim();
  return tpl.content.firstElementChild;
}

// Limpa e injeta HTML num container
export function render(container, htmlString) {
  container.innerHTML = htmlString;
}
