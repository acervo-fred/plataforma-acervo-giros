/* Backup e dados — exportar/importar JSON (rede de segurança que a
   planilha oferecia) e popular o Firestore com os dados de exemplo.
   Acessível em #/dados (link na tela de Configurações). */

import { store } from "../data/store.js";
import { USE_FIRESTORE } from "../config/firebase-config.js";
import * as mock from "../data/mock.js";

function bundleExemplo() {
  return structuredClone({
    projetos: mock.projetos, midias: mock.midias, estrutura: mock.estrutura,
    historico: mock.historico, demandas: mock.demandas, listas: mock.listas,
  });
}

function baixarJSON(obj, nome) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export async function renderAdmin(app) {
  const backend = USE_FIRESTORE ? "Firestore (giros-imagens)" : "Local (neste navegador)";

  app.innerHTML = `
    <a class="back-link" href="#/config">← Voltar para Configurações</a>
    <div class="page-head"><div>
      <h1 class="page-title">Backup e dados</h1>
      <div class="page-sub">Backend atual: <strong>${backend}</strong></div>
    </div></div>

    <div class="config-grid">
      <div class="cfg-card">
        <div class="cfg-card-head"><h3>Exportar backup</h3></div>
        <div style="padding:16px">
          <p class="muted" style="margin-top:0;font-size:13.5px">Baixa um arquivo JSON com todos os dados (projetos, mídias, estrutura, histórico, demandas e listas). Faça isso periodicamente.</p>
          <button class="btn btn-primary" id="btn-export">⬇ Exportar JSON</button>
        </div>
      </div>

      <div class="cfg-card">
        <div class="cfg-card-head"><h3>Importar backup</h3></div>
        <div style="padding:16px">
          <p class="muted" style="margin-top:0;font-size:13.5px">Restaura a partir de um JSON exportado. Os registros são gravados pelos mesmos IDs (referências preservadas).</p>
          <input type="file" id="file-import" accept="application/json" style="display:none" />
          <button class="btn" id="btn-import">⬆ Escolher arquivo…</button>
          <div id="import-status" class="muted" style="font-size:13px;margin-top:8px"></div>
        </div>
      </div>

      <div class="cfg-card">
        <div class="cfg-card-head"><h3>Migrar localStorage → Firestore</h3></div>
        <div style="padding:16px">
          <p class="muted" style="margin-top:0;font-size:13.5px">Envia todos os dados salvos neste navegador (localStorage) para o Firestore. Use uma vez para migrar.</p>
          <button class="btn btn-primary" id="btn-migrar">🔄 Migrar para Firestore</button>
          <div id="migrar-status" class="muted" style="font-size:13px;margin-top:8px"></div>
        </div>
      </div>

      <div class="cfg-card">
        <div class="cfg-card-head"><h3>Dados de exemplo</h3></div>
        <div style="padding:16px">
          <p class="muted" style="margin-top:0;font-size:13.5px">Grava o conjunto de exemplo no backend atual (útil para popular o Firestore na primeira vez). Sobrescreve itens de mesmo ID.</p>
          <button class="btn" id="btn-seed">Popular com dados de exemplo</button>
          <div id="seed-status" class="muted" style="font-size:13px;margin-top:8px"></div>
        </div>
      </div>
    </div>
  `;

  // exportar
  app.querySelector("#btn-export").addEventListener("click", async () => {
    const dados = await store.exportAll();
    const carimbo = new Date().toISOString().slice(0, 10);
    baixarJSON({ versao: 1, exportadoEm: new Date().toISOString(), ...dados }, `plataforma-acervo-giros-backup-${carimbo}.json`);
  });

  // importar
  const fileInput = app.querySelector("#file-import");
  const importStatus = app.querySelector("#import-status");
  app.querySelector("#btn-import").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (!confirm("Importar este backup? Itens com o mesmo ID serão sobrescritos.")) { fileInput.value = ""; return; }
    importStatus.textContent = "Importando…";
    try {
      const dados = JSON.parse(await file.text());
      await store.importAll(dados);
      importStatus.textContent = "✓ Importado. Recarregando…";
      setTimeout(() => { location.hash = "#/"; location.reload(); }, 600);
    } catch (err) {
      importStatus.textContent = "✗ Erro: " + err.message;
    }
    fileInput.value = "";
  });

  // migrar localStorage → Firestore
  const migrarStatus = app.querySelector("#migrar-status");
  app.querySelector("#btn-migrar")?.addEventListener("click", async () => {
    const LS_KEY = "acervo-giros-db-v1";
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) { migrarStatus.textContent = "✗ Nenhum dado encontrado no localStorage."; return; }
    if (!confirm("Enviar todos os dados do localStorage para o Firestore? Itens com mesmo ID serão sobrescritos.")) return;
    migrarStatus.textContent = "Migrando…";
    try {
      const dados = JSON.parse(raw);
      await store.importAll(dados);
      migrarStatus.textContent = "✓ Migração concluída. Recarregando…";
      setTimeout(() => { location.hash = "#/"; location.reload(); }, 600);
    } catch (err) {
      migrarStatus.textContent = "✗ Erro: " + err.message;
    }
  });

  // popular exemplo
  const seedStatus = app.querySelector("#seed-status");
  app.querySelector("#btn-seed").addEventListener("click", async () => {
    if (!confirm(`Gravar dados de exemplo em: ${backend}?`)) return;
    seedStatus.textContent = "Gravando…";
    try {
      await store.importAll(bundleExemplo());
      seedStatus.textContent = "✓ Concluído. Recarregando…";
      setTimeout(() => { location.hash = "#/"; location.reload(); }, 600);
    } catch (err) {
      seedStatus.textContent = "✗ Erro: " + err.message;
    }
  });
}
