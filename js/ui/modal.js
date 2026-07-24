/* Framework de modal + widgets de formulário reutilizáveis.
   Um padrão único para todo cadastro/edição do sistema. */

import { esc } from "./dom.js";

const root = () => document.getElementById("modal-root");

/* Abre um modal. opts:
   - title, subtitle
   - bodyHtml: string (conteúdo do <form>)
   - submitLabel (padrão "Salvar")
   - onSubmit(formEl): pode lançar Error(msg) p/ exibir erro e não fechar;
     se resolver, o modal fecha. Pode ser async.
   - onMount(formEl): chamado após render (para hidratar widgets) */
export function openModal(opts) {
  const {
    title, subtitle = "", bodyHtml = "",
    submitLabel = "Salvar", onSubmit, onMount,
  } = opts;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div>
          <h2>${esc(title)}</h2>
          ${subtitle ? `<div class="modal-sub">${esc(subtitle)}</div>` : ""}
        </div>
        <button class="modal-close" type="button" aria-label="Fechar">×</button>
      </div>
      <form novalidate>
        <div class="modal-body">
          <div class="form-error" style="display:none"></div>
          ${bodyHtml}
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
          <button type="submit" class="btn btn-primary">${esc(submitLabel)}</button>
        </div>
      </form>
    </div>`;

  root().appendChild(overlay);
  const form = overlay.querySelector("form");
  const errBox = overlay.querySelector(".form-error");

  function close() {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key === "Escape") close(); }
  document.addEventListener("keydown", onKey);

  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
  overlay.querySelector(".modal-close").addEventListener("click", close);
  overlay.querySelector("[data-close]").addEventListener("click", close);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errBox.style.display = "none";
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await onSubmit?.(form);
      close();
    } catch (err) {
      errBox.textContent = err.code === "permission-denied"
        ? "Você precisa estar logado com uma conta autorizada para editar."
        : (err.message || "Erro ao salvar.");
      errBox.style.display = "block";
      btn.disabled = false;
    }
  });

  onMount?.(form);
  // foco no primeiro campo
  form.querySelector("input, select, textarea")?.focus();
  return { close };
}

/* ---------- helpers de campo (HTML) ---------- */

export function fieldText(name, label, { value = "", type = "text", hint = "", required = false, placeholder = "" } = {}) {
  return `<div class="field">
    <label for="f_${name}">${esc(label)}${required ? " *" : ""}</label>
    <input type="${type}" id="f_${name}" name="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}" />
    ${hint ? `<div class="field-hint">${esc(hint)}</div>` : ""}
  </div>`;
}

export function fieldTextarea(name, label, { value = "", hint = "" } = {}) {
  return `<div class="field">
    <label for="f_${name}">${esc(label)}</label>
    <textarea id="f_${name}" name="${name}">${esc(value)}</textarea>
    ${hint ? `<div class="field-hint">${esc(hint)}</div>` : ""}
  </div>`;
}

/* lista pode ser ["a","b"] ou [{valor,cor}] */
export function fieldSelect(name, label, lista, { value = "", required = false } = {}) {
  const opts = lista.map((it) => {
    const v = typeof it === "string" ? it : it.valor;
    return `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(v)}</option>`;
  }).join("");
  return `<div class="field">
    <label for="f_${name}">${esc(label)}${required ? " *" : ""}</label>
    <select id="f_${name}" name="${name}">${opts}</select>
  </div>`;
}

/* tags (multi-valor digitado). Hidratar com hydrateTags(form, name). */
export function fieldTags(name, label, { hint = "", placeholder = "digite e Enter" } = {}) {
  return `<div class="field">
    <label>${esc(label)}</label>
    <div class="tags-input" data-tags="${name}">
      <input type="text" placeholder="${esc(placeholder)}" />
    </div>
    ${hint ? `<div class="field-hint">${esc(hint)}</div>` : ""}
  </div>`;
}

/* checklist de seleção múltipla (ex.: projetos). itens: [{value,label}]
   marcados: array de values pré-selecionados. */
export function fieldChecklist(name, label, itens, { hint = "", marcados = [] } = {}) {
  const sel = new Set(marcados);
  const rows = itens.map((it) =>
    `<label><input type="checkbox" name="${name}" value="${esc(it.value)}" ${sel.has(it.value) ? "checked" : ""}/> ${esc(it.label)}</label>`
  ).join("");
  return `<div class="field">
    <label>${esc(label)}</label>
    <div class="checklist">${rows || '<div class="empty">Nenhum projeto cadastrado ainda.</div>'}</div>
    ${hint ? `<div class="field-hint">${esc(hint)}</div>` : ""}
  </div>`;
}

/* ---------- hidratação / leitura de widgets ---------- */

// transforma um .tags-input em widget funcional. iniciais: tags pré-existentes.
export function hydrateTags(form, name, iniciais = []) {
  const box = form.querySelector(`.tags-input[data-tags="${name}"]`);
  if (!box) return;
  const input = box.querySelector("input");
  const valores = [...iniciais];

  function redraw() {
    box.querySelectorAll(".ti-chip").forEach((c) => c.remove());
    valores.forEach((v, i) => {
      const chip = document.createElement("span");
      chip.className = "ti-chip";
      chip.innerHTML = `${esc(v)} <button type="button" aria-label="remover">×</button>`;
      chip.querySelector("button").addEventListener("click", () => {
        valores.splice(i, 1); redraw();
      });
      box.insertBefore(chip, input);
    });
  }
  function add() {
    const v = input.value.trim();
    if (v && !valores.includes(v)) { valores.push(v); redraw(); }
    input.value = "";
  }
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
    else if (e.key === "Backspace" && !input.value && valores.length) { valores.pop(); redraw(); }
  });
  input.addEventListener("blur", add);
  box._getValues = () => valores.slice();
  redraw(); // mostra as tags iniciais (modo edição)
}

export function readTags(form, name) {
  const box = form.querySelector(`.tags-input[data-tags="${name}"]`);
  return box && box._getValues ? box._getValues() : [];
}

export function readChecklist(form, name) {
  return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((c) => c.value);
}

export function readValue(form, name) {
  const el = form.elements[name];
  return el ? el.value.trim() : "";
}
