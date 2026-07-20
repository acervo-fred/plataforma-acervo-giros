/* Organização — antiga aba "Caderno", agora com mais três seções
   herdadas do protótipo "Avaliação do Acervo" (acervo-giros):
   Glossário, Sugestão de Metadados e Projetos do Acervo. */

import { renderCaderno } from "./caderno.js";
import { renderGlossario } from "./organizacao-glossario.js";
import { renderMetadados } from "./organizacao-metadados.js";
import { renderProjetosPrioridade } from "./organizacao-projetos.js";

const PASTAS = [
  { id: "caderno", label: "Caderno" },
  { id: "glossario", label: "Glossário" },
  { id: "metadados", label: "Sugestão de Metadados" },
  { id: "projetos", label: "Projetos do Acervo" },
];

const FOLDER_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;

export async function renderOrganizacao(app, sub) {
  const atual = PASTAS.some((p) => p.id === sub) ? sub : "caderno";

  app.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Organização</h1>
        <div class="page-sub">Anotações, glossário e priorização do acervo</div>
      </div>
    </div>
    <div class="org-tabs" id="org-tabs">
      ${PASTAS.map((p) => `<a href="#/organizacao/${p.id}" class="org-tab ${p.id === atual ? "active" : ""}">${FOLDER_ICON}${p.label}</a>`).join("")}
    </div>
    <div class="org-panel" id="org-content"></div>
  `;

  const cont = app.querySelector("#org-content");
  if (atual === "caderno") renderCaderno(cont);
  else if (atual === "glossario") await renderGlossario(cont);
  else if (atual === "metadados") await renderMetadados(cont);
  else if (atual === "projetos") await renderProjetosPrioridade(cont);
}
