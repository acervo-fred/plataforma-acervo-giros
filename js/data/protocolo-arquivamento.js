/* Protocolo de Arquivamento — estrutura fixa (12 seções numeradas) do
   checklist de organização de pastas de cada projeto. Cada item-folha
   (sem "children") tem estado created/organized guardado no projeto,
   no campo protocoloArquivamento (ver getProtocolo/setProtocoloItem
   em js/data/store.js e js/data/firestore.js). */

export const SECOES_PROTOCOLO = [
  { id: "1", title: "Brutos", items: [
    { id: "1.1", name: "Imagem" },
    { id: "1.2", name: "Áudio" } ]},
  { id: "2", title: "Arquivos", items: [
    { id: "2.1", name: "Alta", desc: "Arquivos licenciados" },
    { id: "2.2", name: "Planilha de arquivos", desc: "Atualizada, para localizarmos as fontes no futuro, caso necessário" } ]},
  { id: "3", title: "Artes e logos", items: [
    { id: "3.1", name: "Videografismo", desc: "Exportados + pacote gráfico" },
    { id: "3.2", name: "Louros", desc: "Caso tenha" },
    { id: "3.3", name: "Cartaz" } ]},
  { id: "4", title: "Docs", items: [
    { id: "4.1", name: "ODs" },
    { id: "4.2", name: "Roteiros" },
    { id: "4.3", name: "Autorizações" },
    { id: "4.4", name: "Relatório de logagem", desc: "E demais relatórios de produção" } ]},
  { id: "5", title: "Projetos", items: [
    { id: "5.1", name: "Edição" },
    { id: "5.2", name: "Finalização" },
    { id: "5.3", name: "Masterização" } ]},
  { id: "6", title: "Cor", items: [
    { id: "6.1", name: "Base limpa" },
    { id: "6.2", name: "Alta", desc: "Caso tenha uma versão que não seja base limpa" } ]},
  { id: "7", title: "Mix", items: [
    { id: "7.1", name: "2.0" },
    { id: "7.2", name: "5.1", desc: "Caso tenha" } ]},
  { id: "8", title: "Trilha sonora", items: [
    { id: "8.1", name: "Arquivos de trilha" },
    { id: "8.2", name: "Music cue sheet" } ]},
  { id: "9", title: "Legenda", items: [] },
  { id: "10", title: "Acessibilidade", items: [
    { id: "10.1", name: "CC" },
    { id: "10.2", name: "Libras" },
    { id: "10.3", name: "Audiodescrição" } ]},
  { id: "11", title: "Master", items: [
    { id: "11.1", name: "Giros", children: [
      { id: "11.1.1", name: "Master ProRes" },
      { id: "11.1.2", name: "Master H264" } ]},
    { id: "11.2", name: "Legendada", desc: "Caso tenha" },
    { id: "11.3", name: "Delivery" },
    { id: "11.4", name: "DCP" },
    { id: "11.5", name: "Cópia CPB" } ]},
  { id: "12", title: "Divulgação", items: [
    { id: "12.1", name: "Making of" },
    { id: "12.2", name: "Trailer / promo / pílulas" } ]},
];

// referência estática — 6 fases do processo (não interativo), texto
// vindo do PDF "Protocolo de Arquivamento" (~/Desktop)
export const FASES_PROCESSO = [
  { titulo: "Levantamento do material", desc: "Identificação de todos os materiais existentes: HDs, pastas em servidores, mídias físicas etc." },
  { titulo: "Organização do material", desc: "Estruturação das pastas conforme o padrão do protocolo." },
  { titulo: "Catalogação dos brutos", desc: "Catalogação completa de todo o material bruto da obra (metadados, descrições, indexação)." },
  { titulo: "Catalogação de material adicional", desc: "Catalogação dos arquivos e materiais complementares (documentos, artes, projetos etc.)." },
  { titulo: "Backup do projeto organizado", desc: "Geração de cópias de segurança do projeto organizado em pelo menos duas mídias diferentes." },
  { titulo: "Arquivamento", desc: "Armazenamento final do projeto em mídia de longo prazo, com identificação e registro no sistema de acervo." },
];

// ids de todo item-folha da árvore inteira (entra em items[] direto,
// ou dentro de um items[].children[])
export function idsFolha() {
  const ids = [];
  for (const secao of SECOES_PROTOCOLO) {
    for (const item of secao.items) {
      if (item.children) item.children.forEach((c) => ids.push(c.id));
      else ids.push(item.id);
    }
  }
  return ids;
}

// ids de folha de uma seção específica
export function idsFolhaDaSecao(secao) {
  const ids = [];
  for (const item of secao.items) {
    if (item.children) item.children.forEach((c) => ids.push(c.id));
    else ids.push(item.id);
  }
  return ids;
}

// checklist zerado — todo projeto novo nasce com isto
export function protocoloZerado() {
  return Object.fromEntries(idsFolha().map((id) => [id, { created: false, organized: false, nota: "" }]));
}
