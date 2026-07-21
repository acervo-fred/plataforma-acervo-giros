/* Router por hash (#/...), compatível com GitHub Pages sem
   configuração de servidor. Cada rota renderiza uma view dentro
   de #app. A sidebar e o drawer de atividade ficam fora do #app
   (são persistentes) e são atualizados aqui. */

import { store } from "./data/store.js";
import { renderHome } from "./views/home.js";
import { renderProjeto } from "./views/projeto.js";
import { renderMidia } from "./views/midia.js";
import { renderMidiaPastas } from "./views/midia-pastas.js";
import { renderMidiasLista } from "./views/midias-list.js";
import { renderHistoricoLista } from "./views/historico-list.js";
import { renderDemandasLista } from "./views/demandas-list.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderConfig } from "./views/config.js";
import { renderAdmin } from "./views/admin.js";
import { renderOrganizacao } from "./views/organizacao.js";
import { renderFitasLista } from "./views/fitas-list.js";
import { esc } from "./ui/dom.js";
import { iconClock, iconAlert } from "./ui/icons.js";
import { abrirNovaDemanda } from "./views/cadastros.js";

const app = document.getElementById("app");

function setActiveNav(name) {
  document.querySelectorAll("[data-nav]").forEach((a) =>
    a.classList.toggle("active", a.dataset.nav === name)
  );
}

function placeholder(titulo, msg) {
  app.innerHTML = `
    <a class="back-link" href="#/">← Voltar para projetos</a>
    <h1 class="page-title">${titulo}</h1>
    <div class="empty">${msg}</div>`;
}

async function router() {
  if (!location.hash || location.hash === "#") {
    location.replace(location.pathname + "#/");
    return;
  }
  const hash = location.hash;
  const [rota, param] = hash.replace(/^#\//, "").split("/");

  window.scrollTo(0, 0);

  try {
    switch (rota) {
      case "":
      case undefined:
        setActiveNav("projetos");
        await renderHome(app);
        break;
      case "projeto":
        setActiveNav("projetos");
        await renderProjeto(app, param);
        break;
      case "midias":
        setActiveNav("midias");
        await renderMidiasLista(app);
        break;
      case "midia":
        setActiveNav("midias");
        await renderMidia(app, param);
        break;
      case "midia-pastas":
        setActiveNav("midias");
        await renderMidiaPastas(app, param);
        break;
      case "historico":
        setActiveNav("historico");
        await renderHistoricoLista(app);
        break;
      case "demandas":
        setActiveNav("demandas");
        await renderDemandasLista(app);
        break;
      case "dashboard":
        setActiveNav("dashboard");
        await renderDashboard(app);
        break;
      case "config":
        setActiveNav("config");
        await renderConfig(app);
        break;
      case "dados":
        setActiveNav("config");
        await renderAdmin(app);
        break;
      case "fitas":
        setActiveNav("fitas");
        await renderFitasLista(app);
        break;
      case "organizacao":
        setActiveNav("organizacao");
        await renderOrganizacao(app, param);
        break;
      default:
        placeholder("Página não encontrada", "Verifique o endereço.");
    }
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="empty">Erro ao carregar a tela.<br><small>${esc(err.message)}</small></div>`;
  }

  atualizarAtividade();
  atualizarSidebarListas().then(marcarSidebarAtivo);
}

/* ---------- Sidebar: listas expansíveis (Projetos / Mídias) ---------- */
async function atualizarSidebarListas() {
  const [projetos, midias] = await Promise.all([store.listProjetos(), store.listMidias()]);
  const lpEl = document.getElementById("sg-list-projetos");
  const lmEl = document.getElementById("sg-list-midias");
  const sortNome = (a, b) => a.nome.localeCompare(b.nome, "pt-BR");
  if (lpEl) lpEl.innerHTML = projetos.slice().sort(sortNome).map((p) =>
    `<a href="#/projeto/${esc(p.id)}" data-sid="${esc(p.id)}">${esc(p.nome)}</a>`
  ).join("");
  if (lmEl) lmEl.innerHTML = midias.slice().sort(sortNome).map((m) =>
    `<a href="#/midia/${esc(m.id)}" data-sid="${esc(m.id)}">${esc(m.nome)}</a>`
  ).join("");
}

function ligarSidebarGrupos() {
  document.querySelectorAll(".side-group").forEach((g) => {
    const caretBtn = g.querySelector(".sg-caret-btn");
    if (caretBtn) {
      caretBtn.addEventListener("click", () => g.classList.toggle("open"));
    }
    // o link do cabeçalho só navega — quem decide o "aberto" é
    // marcarSidebarAtivo(), com base na rota atual (fecha sozinho
    // ao sair da seção, em vez de ficar aberto pra sempre)
  });
}

function marcarSidebarAtivo() {
  const hash = location.hash || "#/";
  document.querySelectorAll(".sg-list a").forEach((a) => {
    const href = a.getAttribute("href");
    a.classList.toggle("sg-active", href === hash);
  });
  // grupo fica aberto só enquanto se está vendo um item dele —
  // navegar pra qualquer outra tela fecha automaticamente
  const [rota, param] = hash.replace(/^#\//, "").split("/");
  const sgProjetos = document.getElementById("sg-projetos");
  const sgMidias = document.getElementById("sg-midias");
  sgProjetos?.classList.toggle("open", rota === "projeto" && !!param);
  sgMidias?.classList.toggle("open", rota === "midia" && !!param);
}

/* ---------- Drawer "Atividade recente" (sidebar) ---------- */
async function atualizarAtividade() {
  const cont = document.getElementById("ad-list");
  if (!cont) return;
  const itens = await store.atividadeRecente(15);
  cont.innerHTML = itens.length
    ? itens.map((a) => {
        const icon = a.tipo === "demanda" ? iconAlert() : iconClock();
        return `<div class="activity-item" ${a.projetoId ? `data-projeto="${esc(a.projetoId)}"` : ""} style="cursor:${a.projetoId ? "pointer" : "default"}">
          <span class="ai-when">${icon} ${esc(a.quando)}</span>
          <span><span class="ai-proj">${esc(a.projetoNome)}</span> · ${esc(a.texto)}</span>
        </div>`;
      }).join("")
    : `<div class="empty">Nada recente.</div>`;
}

function ligarDrawer() {
  const drawer = document.getElementById("activity-drawer");
  const tab = document.getElementById("ad-tab");
  const list = document.getElementById("ad-list");
  if (!drawer) return;
  // clique no botão fixa/desfixa o painel aberto
  tab.addEventListener("click", () => drawer.classList.toggle("open"));
  // clique num item navega para o projeto e fecha
  list.addEventListener("click", (e) => {
    const item = e.target.closest("[data-projeto]");
    if (!item || !item.dataset.projeto) return;
    drawer.classList.remove("open");
    location.hash = `#/projeto/${item.dataset.projeto}`;
  });
  // clicar fora fecha o painel fixado
  document.addEventListener("click", (e) => {
    if (drawer.classList.contains("open") && !drawer.contains(e.target)) {
      drawer.classList.remove("open");
    }
  });
}

window.addEventListener("hashchange", router);
window.addEventListener("data-changed", router);

// type="module" é sempre deferido; o top-level await do store.js faz o
// DOMContentLoaded disparar antes de app.js terminar — por isso iniciamos
// diretamente aqui, quando o módulo já resolveu e o DOM está garantidamente pronto.
ligarDrawer();
ligarSidebarGrupos();
router();
document.getElementById("btn-cadastrar-demanda")?.addEventListener("click", () => abrirNovaDemanda());
