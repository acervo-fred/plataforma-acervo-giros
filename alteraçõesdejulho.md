# Prompt para Claude Code — Melhorias de navegação no Acervo Giros

Contexto: projeto de gerenciamento de acervo (HTML/CSS/JS + Firebase Firestore, hospedado no GitHub Pages, projeto Firebase `giros-imagens`). O schema de dados tem estas coleções principais: `projetos`, `midias` (HDs/LTOs), `estrutura` (pastas por tipo de material), `fitas` (mídias físicas antigas tipo Betacam) e `listas` (listas de referência com cor por valor, ex: `statusProjeto`, `statusPasta`, `statusMidia`, `prioridade`).

Implemente as seguintes melhorias de navegação, sem alterar o restante do fluxo já existente:

## 1. Navegação bidirecional Projeto ↔ Mídia

Hoje a relação entre projeto e mídia é muitos-para-muitos: uma mídia (HD/LTO) pode conter conteúdo de vários projetos (ver campo `conteudoPorProjeto`, um mapa `{projetoId: resumo}` dentro de cada documento de `midias`), e o material de um projeto pode estar espalhado em várias mídias.

- **Na página do projeto**: adicionar/ajustar uma seção "Mídias" listando todas as mídias que contêm esse projeto (buscar em `midias` onde `projetosArmazenados` contém o `projetoId`, ou onde `conteudoPorProjeto[projetoId]` existe), mostrando o resumo específico daquele projeto naquela mídia (não o conteúdo genérico da mídia inteira).
- **Na página da mídia (HD/LTO)**: mostrar a lista de todos os projetos armazenados ali, cada um com seu resumo específico (via `conteudoPorProjeto`), com link de volta para a página de cada projeto.
- As duas telas devem ser espelhos uma da outra — navegar de um projeto para uma mídia e de volta para o mesmo projeto (ou outro projeto na mesma mídia) sem perder contexto.

## 2. Reaproveitar o sistema de cor por status já existente em `listas`

`listas` já define cor canônica por valor para `statusProjeto`, `statusPasta`, `statusMidia` e `prioridade` (ex: `{cor: "blue", valor: "Catalogando"}`). Hoje isso pode estar sendo usado só em alguns lugares ou reimplementado com cores hardcoded em outros.

- Centralizar a resolução de cor de status num único helper/função que sempre consulta `listas` (nunca cor hardcoded no componente).
- Aplicar essa mesma função em **todos** os badges de status do sistema: card de projeto, linha de mídia, linha de pasta em `estrutura`, prioridade de demanda — garantindo que a mesma paleta apareça em qualquer lugar que mostre esses campos.
- Se algum valor de status não estiver presente em `listas` (dado legado/inconsistente), usar uma cor neutra padrão (cinza) em vez de quebrar ou usar cor aleatória.

## 3. Aba própria para Fitas, mas cross-linkada ao projeto

`fitas` é uma categoria de mídia física distinta de `midias` (HD/LTO) — tem campos próprios (`codigo`, `tipo` como "Betacam 30", `statusFita`, `localFisico`).

- Na página do projeto, adicionar uma aba/seção separada "Fitas" (distinta da seção "Mídias" do item 1), listando as fitas vinculadas àquele projeto via `projetoId`.
- Não misturar fitas e mídias digitais na mesma lista/tabela — são tipos de registro diferentes, com campos diferentes.

## 4. Tratamento de dados vazios/placeholder na exibição

- Quando `ano` de um projeto for `1900` (valor placeholder para "não informado" usado no sistema atual), exibir "Ano não informado" em vez do número cru "1900" em qualquer lugar que mostre o ano do projeto (cards, header da página de projeto, etc.).
- O campo `projetoNome` dentro de `fitas` é denormalizado e pode estar vazio ou desatualizado. Ao exibir o nome do projeto vinculado a uma fita, **sempre resolver o nome buscando o documento `projetos` pelo `projetoId`** em vez de ler o campo `projetoNome` diretamente. Se quiser, pode manter `projetoNome` apenas como cache interno, mas nunca como fonte de exibição.

## Fora de escopo neste prompt

Não implementar agora: painel central de pendências (cross-projeto) e timeline de histórico por projeto — isso será tratado separadamente.
