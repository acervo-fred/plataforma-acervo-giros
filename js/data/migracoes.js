/* ============================================================
   Migrações pontuais de schema — idempotentes.

   Não são chamadas por nenhuma tela: rodam sob demanda, no console
   do navegador, com a pessoa logada como editor.

     await window.migrarProjetos({ dryRun: true })  // só relata
     await window.migrarProjetos()                  // grava

   As telas NÃO dependem destas migrações (leem `capa || ""` e
   `linksExternos || []`); elas só deixam o schema uniforme.
   ============================================================ */

import { store } from "./store.js";

/* Garante que todo projeto tenha `capa` (string), `linksExternos`
   (array) e `formato` (string). Só escreve nos documentos a que falta
   algum dos três — rodar de novo não faz nada. */
export async function migrarCamposProjeto({ dryRun = false, somenteId = null } = {}) {
  const projetos = await store.listProjetos();
  const alvos = (somenteId ? projetos.filter((p) => p.id === somenteId) : projetos)
    .map((p) => {
      const campos = {};
      if (typeof p.capa !== "string") campos.capa = "";
      if (!Array.isArray(p.linksExternos)) campos.linksExternos = [];
      if (!p.formato) campos.formato = "Longa-metragem";
      return { p, campos };
    })
    .filter(({ campos }) => Object.keys(campos).length > 0);

  console.info(
    `[migração] ${projetos.length} projetos · ${alvos.length} precisam de ajuste` +
    (dryRun ? " (dryRun: nada foi gravado)" : "")
  );
  alvos.forEach(({ p, campos }) => console.info(`  · ${p.nome} (${p.id}) ← ${Object.keys(campos).join(", ")}`));

  if (dryRun) return { total: projetos.length, pendentes: alvos.length, gravados: 0 };

  let gravados = 0;
  for (const { p, campos } of alvos) {
    await store.updateProjeto(p.id, campos);
    gravados++;
  }
  console.info(`[migração] ${gravados} projetos atualizados.`);
  return { total: projetos.length, pendentes: alvos.length, gravados };
}

/* Renomeia a nomenclatura de status de projeto para a nova, pedida
   nesta rodada: "Não iniciado"(cinza) → "Catalogando"(azul) →
   "Ativo"(laranja) → "Completo"(verde). É a MESMA lista de sempre,
   só que:
   - "Catalogado" vira "Completo" (cor verde mantida)
   - "Ativo" muda de cor: era rosa, passa a ser laranja/âmbar
   Depois de trocar a lista, migra os projetos que ainda tiverem o
   valor antigo "Catalogado" gravado — sem isso, o badge deles
   ficaria "órfão" (cinza, sem cor reconhecida). Idempotente: rodar de
   novo com a lista já trocada não faz nada. */
const STATUS_PROJETO_NOVO = [
  { valor: "Não iniciado", cor: "gray" },
  { valor: "Catalogando", cor: "blue" },
  { valor: "Ativo", cor: "amber" },
  { valor: "Completo", cor: "green" },
];
const RENOMEIA_VALOR = { "Catalogado": "Completo" };

function listaJaAtualizada(lista) {
  if (!Array.isArray(lista) || lista.length !== STATUS_PROJETO_NOVO.length) return false;
  return STATUS_PROJETO_NOVO.every((alvo, i) => lista[i]?.valor === alvo.valor && lista[i]?.cor === alvo.cor);
}

export async function migrarStatusProjeto({ dryRun = false } = {}) {
  const [listas, projetos] = await Promise.all([store.getListas(), store.listProjetos()]);
  const listaPrecisaTrocar = !listaJaAtualizada(listas.statusProjeto);
  const projetosAlvo = projetos.filter((p) => RENOMEIA_VALOR[p.statusProjeto]);

  console.info(
    `[migração status] lista ${listaPrecisaTrocar ? "precisa ser trocada" : "já está atualizada"} · ` +
    `${projetosAlvo.length} projeto(s) com valor antigo` +
    (dryRun ? " (dryRun: nada foi gravado)" : "")
  );
  projetosAlvo.forEach((p) => console.info(`  · ${p.nome} (${p.id}): "${p.statusProjeto}" → "${RENOMEIA_VALOR[p.statusProjeto]}"`));

  if (dryRun) return { listaPrecisaTrocar, projetosPendentes: projetosAlvo.length, gravados: 0 };

  if (listaPrecisaTrocar) await store.saveLista("statusProjeto", STATUS_PROJETO_NOVO);
  let gravados = 0;
  for (const p of projetosAlvo) {
    await store.updateProjeto(p.id, { statusProjeto: RENOMEIA_VALOR[p.statusProjeto] });
    gravados++;
  }
  console.info(`[migração status] lista atualizada${listaPrecisaTrocar ? "" : " (já estava)"} · ${gravados} projeto(s) migrado(s).`);
  return { listaPrecisaTrocar, projetosPendentes: projetosAlvo.length, gravados };
}
