/* Backup e dados — exportar/importar JSON (rede de segurança que a
   planilha oferecia). Acessível em #/dados (link na tela de Configurações).

   O backup reúne:
   - todas as coleções do Acervo no Firestore (store.exportAll);
   - o nó "acervo" do Realtime Database (avaliação das fitas, fitas
     contabilizadas, dados do protótipo) — lido/gravado via REST;
   - o Caderno, que vive só no localStorage deste navegador. */

import { store } from "../data/store.js";
import { USE_FIRESTORE } from "../config/firebase-config.js";
import { usuarioAdmin } from "../data/auth.js";
import { esc } from "../ui/dom.js";
import { hashVoltar } from "../ui/nav-history.js";

const RTDB_ACERVO = "https://giros-imagens-default-rtdb.firebaseio.com/acervo";
const CADERNO_KEY = "acervo-giros-caderno-html";

const ROTULOS = {
  projetos: "projetos", midias: "mídias", estrutura: "pastas (estrutura)",
  historico: "registros de histórico", demandas: "demandas",
  fitas: "blocos de fitas", config: "configurações (listas, prioridades, equipe)",
  organizacaoGlossario: "termos do glossário", organizacaoMetadados: "sugestões de metadados",
  organizacaoProjetosFaltantes: "projetos faltantes", acessos: "e-mails com acesso",
};

function baixarJSON(obj, nome) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* transforma {a:{b:{c:1}}} em {"a/b/c":1} até a profundidade dada —
   assim o PATCH do RTDB mescla nota por nota, sem apagar o que for
   mais novo que o backup */
function achatar(obj, prof, prefixo = "", saida = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const caminho = prefixo ? `${prefixo}/${k}` : k;
    if (prof > 1 && v && typeof v === "object" && !Array.isArray(v)) achatar(v, prof - 1, caminho, saida);
    else saida[caminho] = v;
  }
  return saida;
}

function resumoHtml(dados) {
  const linhas = Object.entries(ROTULOS)
    .filter(([k]) => Array.isArray(dados[k]))
    .map(([k, r]) => {
      const qtd = k === "fitas"
        ? `${dados.fitas.reduce((s, b) => s + (b.itens?.length || 0), 0)} fitas`
        : `${dados[k].length} ${r}`;
      return `<li>${esc(qtd)}</li>`;
    });
  if (dados.rtdb?.fitas_avaliacao) linhas.push(`<li>avaliações das fitas de ${Object.keys(dados.rtdb.fitas_avaliacao).length} pessoa(s)</li>`);
  if (dados.caderno) linhas.push(`<li>Caderno</li>`);
  return `<ul style="margin:6px 0 0;padding-left:18px">${linhas.join("")}</ul>`;
}

export async function renderAdmin(app) {
  // só acessível a partir de Configurações, já restrita — mais essa
  // trava aqui é só rede de segurança pra quem digitar a URL direto
  if (!usuarioAdmin()) {
    app.innerHTML = `<a class="back-link" href="${esc(hashVoltar("#/"))}">← Voltar</a>
      <div class="empty">Esta área é restrita ao administrador.</div>`;
    return;
  }

  const backend = USE_FIRESTORE ? "Firestore (giros-imagens)" : "Local (neste navegador)";

  app.innerHTML = `
    <a class="back-link" href="${esc(hashVoltar("#/config"))}">← Voltar</a>
    <div class="page-head"><div>
      <h1 class="page-title">Backup e dados</h1>
      <div class="page-sub">Backend atual: <strong>${backend}</strong></div>
    </div></div>

    <div class="config-grid">
      <div class="cfg-card">
        <div class="cfg-card-head"><h3>Exportar backup</h3></div>
        <div style="padding:16px">
          <p class="muted" style="margin-top:0;font-size:13.5px">Baixa um arquivo JSON com tudo: projetos (com capas), mídias, estrutura, histórico, demandas, fitas e avaliações das fitas, Organização, configurações, acessos e o Caderno deste navegador. Faça isso periodicamente.</p>
          <button class="btn btn-primary" id="btn-export">⬇ Exportar JSON</button>
          <div id="export-status" class="muted" style="font-size:13px;margin-top:8px"></div>
        </div>
      </div>

      <div class="cfg-card">
        <div class="cfg-card-head"><h3>Importar backup</h3></div>
        <div style="padding:16px">
          <p class="muted" style="margin-top:0;font-size:13.5px">Restaura a partir de um JSON exportado aqui. Os registros são gravados pelos mesmos IDs: o que estiver no arquivo sobrescreve, e o que não estiver no arquivo continua como está (nada é apagado).</p>
          <input type="file" id="file-import" accept="application/json,.json" style="display:none" />
          <button class="btn" id="btn-import">⬆ Escolher arquivo…</button>
          <div id="import-status" class="muted" style="font-size:13px;margin-top:8px"></div>
        </div>
      </div>
    </div>
  `;

  // exportar
  const exportStatus = app.querySelector("#export-status");
  const btnExport = app.querySelector("#btn-export");
  btnExport.addEventListener("click", async () => {
    btnExport.disabled = true;
    exportStatus.textContent = "Lendo os dados…";
    try {
      const dados = await store.exportAll();
      try {
        const r = await fetch(`${RTDB_ACERVO}.json`);
        if (r.ok) dados.rtdb = await r.json();
      } catch (e) { console.warn("Backup: não consegui ler o Realtime Database.", e); }
      const caderno = localStorage.getItem(CADERNO_KEY);
      if (caderno) dados.caderno = caderno;

      const agora = new Date();
      const carimbo = agora.toLocaleDateString("sv-SE"); // AAAA-MM-DD no fuso local
      baixarJSON({ app: "plataforma-acervo-giros", versao: 2, exportadoEm: agora.toISOString(), ...dados },
        `plataforma-acervo-giros-backup-${carimbo}.json`);
      exportStatus.innerHTML = "✓ Backup baixado:" + resumoHtml(dados)
        + (dados.rtdb ? "" : `<div style="margin-top:6px">⚠ Avaliações das fitas não entraram (Realtime Database fora do ar).</div>`)
        + (dados.acessos ? "" : `<div style="margin-top:6px">⚠ Lista de acessos não entrou (sem permissão).</div>`);
    } catch (err) {
      exportStatus.textContent = "✗ Erro ao exportar: " + err.message;
    }
    btnExport.disabled = false;
  });

  // importar
  const fileInput = app.querySelector("#file-import");
  const importStatus = app.querySelector("#import-status");
  const btnImport = app.querySelector("#btn-import");
  btnImport.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    let dados;
    try { dados = JSON.parse(await file.text()); }
    catch { importStatus.textContent = "✗ Este arquivo não é um JSON válido."; return; }
    if (!dados || !Array.isArray(dados.projetos) || !Array.isArray(dados.midias)) {
      importStatus.textContent = "✗ Este arquivo não parece um backup da Plataforma Acervo Giros (faltam projetos/mídias).";
      return;
    }
    importStatus.innerHTML = `Arquivo de ${esc(dados.exportadoEm ? new Date(dados.exportadoEm).toLocaleString("pt-BR") : "data desconhecida")}:` + resumoHtml(dados);
    if (!confirm(`Importar este backup${dados.exportadoEm ? " de " + new Date(dados.exportadoEm).toLocaleDateString("pt-BR") : ""}?\n\nItens com o mesmo ID serão sobrescritos pelo que está no arquivo. Nada será apagado.`)) {
      importStatus.textContent = "Importação cancelada.";
      return;
    }

    btnImport.disabled = true;
    const avisos = [];
    try {
      importStatus.textContent = "Gravando no banco…";
      await store.importAll(dados, (feitos, total) => {
        importStatus.textContent = `Gravando no banco… ${feitos} de ${total}`;
      });

      if (dados.rtdb && typeof dados.rtdb === "object") {
        importStatus.textContent = "Gravando avaliações das fitas…";
        const r = await fetch(`${RTDB_ACERVO}.json`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(achatar(dados.rtdb, 4)),
        });
        if (!r.ok) avisos.push("avaliações das fitas não foram restauradas (" + r.status + ")");
      }

      if (dados.caderno) {
        const atual = localStorage.getItem(CADERNO_KEY);
        if (!atual || atual === dados.caderno) localStorage.setItem(CADERNO_KEY, dados.caderno);
        else if (confirm("O Caderno deste navegador já tem anotações diferentes das do backup.\n\nSubstituir pelo Caderno do backup?")) {
          localStorage.setItem(CADERNO_KEY, dados.caderno);
        } else avisos.push("Caderno mantido como estava");
      }

      importStatus.textContent = "✓ Importado" + (avisos.length ? " (" + avisos.join("; ") + ")" : "") + ". Recarregando…";
      setTimeout(() => { location.hash = "#/"; location.reload(); }, avisos.length ? 3000 : 900);
    } catch (err) {
      importStatus.textContent = "✗ Erro ao importar: " + err.message
        + " — parte dos dados pode ter sido gravada; dá pra importar o mesmo arquivo de novo com segurança.";
      btnImport.disabled = false;
    }
  });
}
