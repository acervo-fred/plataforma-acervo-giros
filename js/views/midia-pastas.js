/* Importar caminho (dentro de uma Mídia) — escaneia a mídia externa
   conectada e grava direto na Estrutura das Pastas e Arquivos dessa
   mídia. Projeto vale para todas as pastas marcadas num mesmo lote;
   tipo de material e descrição são definidos pasta a pasta, direto
   na árvore. Dá pra editar cada pasta depois, se precisar de outros
   valores. Mostra o que já está cadastrado nesta mídia pra evitar
   redundância — e bloqueia repetir o mesmo caminho (comparado por
   completo, do nome do HD até a pasta final). */

import { store } from "../data/store.js";
import { esc, formatAno } from "../ui/dom.js";
import { montarSeletorPastas } from "../ui/pasta-tree.js";
import { usuarioAtual } from "../data/auth.js";

export async function renderMidiaPastas(app, midiaId) {
  const midia = await store.getMidia(midiaId);
  if (!midia) {
    app.innerHTML = `<a class="back-link" href="#/midias">← Voltar para mídias</a>
      <div class="empty">Mídia não encontrada.</div>`;
    return;
  }

  // página inteira é de escrita (importar pastas) — quem chegou aqui
  // via URL direta sem estar logado como editor não vê o formulário
  if (!usuarioAtual()) {
    app.innerHTML = `<a class="back-link" href="#/midia/${esc(midiaId)}">← Voltar para ${esc(midia.nome)}</a>
      <div class="empty">Esta área é restrita a quem está editando. Entre como editor para importar pastas.</div>`;
    return;
  }

  const [listas, projetos, estrutura] = await Promise.all([
    store.getListas(),
    store.projetosDaMidia(midiaId),
    store.estruturaDaMidia(midiaId),
  ]);
  const projetosValidos = projetos.filter((p) => p.existe).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  app.innerHTML = `
    <a class="back-link" href="#/midia/${esc(midiaId)}">← Voltar para ${esc(midia.nome)}</a>

    <div class="page-head">
      <div>
        <h1 class="page-title">Importar caminho</h1>
        <div class="page-sub">${esc(midia.nome)} · escaneie a mídia e adicione as pastas direto na Estrutura</div>
      </div>
    </div>

    <div class="section-head"><h2 id="titulo-cadastradas">Já cadastradas nesta mídia (${estrutura.length})</h2></div>
    <div class="list-card" id="lista-cadastradas" style="margin-bottom:22px">
      ${estrutura.length ? estrutura.map((e) => rowCadastrada(e)).join("")
        : `<div class="empty">Nenhuma pasta cadastrada ainda nesta mídia.</div>`}
    </div>

    ${!projetosValidos.length ? `
      <div class="note"><span class="note-i">ⓘ</span> Essa mídia ainda não tem nenhum projeto vinculado. Vincule um projeto em "Projetos armazenados" antes de cadastrar pastas.</div>
    ` : `
      <div class="field" style="margin-bottom:6px;max-width:320px">
        <label for="f-projeto">Projeto</label>
        <select class="input" id="f-projeto">
          ${projetosValidos.map((p) => `<option value="${esc(p.id)}">${esc(p.nome)} (${esc(formatAno(p.ano))})</option>`).join("")}
        </select>
      </div>
      <div class="note" style="margin-top:12px"><span class="note-i">ⓘ</span> Projeto vale para todas as pastas marcadas num mesmo lote. Tipo de material é definido pasta a pasta, direto na árvore — dá pra editar depois, na Estrutura, se precisar.</div>
      <div id="area-scan" style="margin-top:16px"></div>
    `}
  `;

  if (!projetosValidos.length) return;

  const listaCadastradas = app.querySelector("#lista-cadastradas");
  const tituloCadastradas = app.querySelector("#titulo-cadastradas");

  montarSeletorPastas(app.querySelector("#area-scan"), {
    caminhosExistentes: estrutura.map((e) => e.caminho),
    tiposMaterial: listas.tipoMaterial,
    onSalvar: async (marcados) => {
      const projetoId = app.querySelector("#f-projeto").value;
      const novas = await Promise.all(marcados.map((no) => store.addEstrutura({
        projetoId, midiaId, caminho: no.caminho, tipoMaterial: no.tipoMaterial, resumo: no.conteudo,
      })));
      estrutura.push(...novas);
    },
    textoBotaoSalvar: "Adicionar pastas marcadas à Estrutura",
    onSalvo: (qtd) => {
      if (listaCadastradas.querySelector(".empty")) listaCadastradas.innerHTML = "";
      listaCadastradas.innerHTML = estrutura.map((e) => rowCadastrada(e)).join("");
      tituloCadastradas.textContent = `Já cadastradas nesta mídia (${estrutura.length})`;
      const aviso = document.createElement("div");
      aviso.className = "note";
      aviso.innerHTML = `<span class="note-i">ⓘ</span> ${qtd} pasta${qtd > 1 ? "s" : ""} adicionada${qtd > 1 ? "s" : ""} à Estrutura desta mídia.`;
      app.querySelector("#area-scan").prepend(aviso);
    },
  });
}

function rowCadastrada(e) {
  return `<div class="list-row">
    <div class="lr-main">
      <div class="lr-title" style="font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12.5px">${esc(e.caminho)}</div>
      ${e.resumo ? `<div class="lr-sub">${esc(e.resumo)}</div>` : ""}
    </div>
  </div>`;
}
