/* Pequenos utilitários de DOM (sem framework). */

// Escapa texto para inserção segura via innerHTML
export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Ordena demandas: concluídas sempre por último; entre as demais (e dentro
// de cada grupo), por prioridade (ordem da lista listas.prioridade) e depois
// por ordem alfabética da pendência.
export function ordenarDemandas(demandas, listaPrioridade = []) {
  const ordemPrioridade = Object.fromEntries(
    listaPrioridade.map((p, i) => [typeof p === "string" ? p : p.valor, i])
  );
  const indice = (v) => ordemPrioridade[v] ?? Infinity;
  return [...demandas].sort((a, b) => {
    const feitaA = a.status === "Concluída";
    const feitaB = b.status === "Concluída";
    if (feitaA !== feitaB) return feitaA ? 1 : -1;
    const diff = indice(a.prioridade) - indice(b.prioridade);
    if (diff !== 0) return diff;
    return (a.pendencia || "").localeCompare(b.pendencia || "", "pt-BR");
  });
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

// Aviso rápido no canto da tela (some sozinho) — pra erros que não têm
// um modal/formulário por perto pra mostrar a mensagem.
export function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 250);
  }, 3500);
}
