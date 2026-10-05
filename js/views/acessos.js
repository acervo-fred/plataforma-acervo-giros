/* Acessos — quem pode EDITAR a plataforma (a leitura continua livre).
   Mesmo fluxo da tela "Acessos" do Catálogo Projetos Giros: aprova ou
   recusa pedidos, libera um e-mail direto e remove acessos, tudo no
   Firestore — não precisa mais mexer/republicar o firestore.rules pra
   liberar alguém. Só o admin principal (ACERVO_ADMIN) vê o link na
   sidebar; a trava abaixo é só pra quem digitar a URL direto. */

import { usuarioAdmin, usuarioAtual } from "../data/auth.js";
import {
  ACERVO_ADMIN, LISTA_ANTIGA, listarPedidos, aprovarPedido, recusarPedido,
  listarAutorizados, liberarAcesso, revogarAcesso,
} from "../data/acessos.js";
import { esc } from "../ui/dom.js";
import { hashVoltar } from "../ui/nav-history.js";

function formatarData(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// antes de publicar o firestore.rules novo, as coleções de acessos
// ainda não existem pras regras — explica em vez do erro cru
const msgErro = (err) => err.code === "permission-denied"
  ? "Sem permissão no Firestore — publique o firestore.rules atualizado no console do Firebase (giros-imagens → Firestore → Regras)."
  : `Não foi possível carregar (${esc(err.message)}).`;

const linkEmail = (email) => `<a href="mailto:${esc(email)}" class="acesso-email">${esc(email)}</a>`;

export async function renderAcessos(app) {
  if (!usuarioAdmin()) {
    app.innerHTML = `<a class="back-link" href="${esc(hashVoltar("#/"))}">← Voltar</a>
      <div class="empty">Esta área é restrita ao administrador (${esc(ACERVO_ADMIN)}).</div>`;
    return;
  }

  app.innerHTML = `
    <div class="page-head">
      <div><h1 class="page-title">Acessos</h1>
        <div class="page-sub">Quem pode editar a Plataforma Acervo Giros</div></div>
    </div>
    <div class="note"><span class="note-i">ⓘ</span>
      A leitura continua livre (modo Leitor, sem login). Esta lista controla só quem pode cadastrar, editar e excluir.</div>

    <div class="acessos-grid">
      <div class="cfg-card">
        <div class="cfg-card-head"><h3>Pedidos pendentes</h3><span class="cfg-count" id="acessos-pedidos-n"></span></div>
        <div class="acessos-corpo" id="acessos-pedidos"><span class="muted">Carregando…</span></div>
      </div>

      <div class="cfg-card">
        <div class="cfg-card-head"><h3>Liberar um e-mail</h3></div>
        <div class="acessos-corpo">
          <form class="acessos-form" id="acessos-form-liberar">
            <input type="email" class="input" id="acessos-novo-email" placeholder="nome@exemplo.com" required />
            <button type="submit" class="btn btn-primary">Liberar</button>
          </form>
          <div class="muted acessos-status" id="acessos-liberar-status"></div>
        </div>
      </div>

      <div class="cfg-card acessos-card-lista">
        <div class="cfg-card-head"><h3>Acessos liberados</h3><span class="cfg-count" id="acessos-lista-n"></span></div>
        <div class="acessos-corpo" id="acessos-lista"><span class="muted">Carregando…</span></div>
      </div>
    </div>
  `;

  const elPedidos = app.querySelector("#acessos-pedidos");
  const elLista = app.querySelector("#acessos-lista");

  async function carregarPedidos() {
    try {
      const pedidos = await listarPedidos();
      app.querySelector("#acessos-pedidos-n").textContent = pedidos.length || "";
      if (!pedidos.length) { elPedidos.innerHTML = `<span class="muted">Nenhum pedido pendente.</span>`; return; }
      elPedidos.innerHTML = pedidos.map((p) => `
        <div class="acesso-linha" data-uid="${esc(p.uid)}">
          <div class="acesso-info">${linkEmail(p.email)}${p.nome ? ` <span class="muted">· ${esc(p.nome)}</span>` : ""}
            <div class="acesso-meta">pedido em ${formatarData(p.criadoEm)}</div></div>
          <div class="acesso-acoes">
            <button type="button" class="btn btn-primary btn-sm" data-aprovar>Aprovar</button>
            <button type="button" class="btn btn-ghost btn-sm" data-recusar>Recusar</button>
          </div>
        </div>`).join("");
      elPedidos.querySelectorAll(".acesso-linha").forEach((linha) => {
        const pedido = pedidos.find((p) => p.uid === linha.dataset.uid);
        linha.querySelector("[data-aprovar]").addEventListener("click", async () => {
          linha.querySelectorAll("button").forEach((b) => (b.disabled = true));
          try {
            await aprovarPedido(pedido, usuarioAtual().email);
            carregarPedidos(); carregarLista();
          } catch (err) {
            alert("Não foi possível aprovar: " + err.message);
            linha.querySelectorAll("button").forEach((b) => (b.disabled = false));
          }
        });
        linha.querySelector("[data-recusar]").addEventListener("click", async () => {
          if (!confirm(`Recusar o pedido de ${pedido.email}?`)) return;
          linha.querySelectorAll("button").forEach((b) => (b.disabled = true));
          try {
            await recusarPedido(pedido);
            carregarPedidos();
          } catch (err) {
            alert("Não foi possível recusar: " + err.message);
            linha.querySelectorAll("button").forEach((b) => (b.disabled = false));
          }
        });
      });
    } catch (err) {
      console.error(err);
      elPedidos.innerHTML = `<span class="muted">${msgErro(err)}</span>`;
    }
  }

  async function carregarLista() {
    try {
      const lista = (await listarAutorizados()).sort((a, b) => a.email.localeCompare(b.email));
      app.querySelector("#acessos-lista-n").textContent = lista.length + 1;
      const faltando = LISTA_ANTIGA.filter((e) => !lista.some((a) => a.email === e));

      const linhaAdmin = `<div class="acesso-linha">
        <div class="acesso-info">${linkEmail(ACERVO_ADMIN)} <span class="muted">(admin principal)</span></div></div>`;
      const linhas = lista.map((a) => `
        <div class="acesso-linha" data-email="${esc(a.email)}">
          <div class="acesso-info">${linkEmail(a.email)}
            <div class="acesso-meta">liberado em ${formatarData(a.liberadoEm)}${a.liberadoPor ? ` por ${esc(a.liberadoPor)}` : ""}</div></div>
          <div class="acesso-acoes">
            <button type="button" class="btn btn-ghost btn-sm acesso-remover" data-revogar>Remover</button>
          </div>
        </div>`).join("");
      const importar = faltando.length ? `
        <div class="acessos-importar">
          <div><strong>Lista antiga</strong> — ${faltando.length} e-mail(s) que editavam antes desta tela e ainda não estão aqui:
            <div class="acesso-meta">${faltando.map(esc).join(", ")}</div></div>
          <button type="button" class="btn btn-sm" id="acessos-btn-importar">Importar lista antiga</button>
        </div>` : "";
      elLista.innerHTML = importar + linhaAdmin + linhas;

      elLista.querySelectorAll("[data-revogar]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const email = btn.closest(".acesso-linha").dataset.email;
          if (!confirm(`Remover o acesso de ${email}?`)) return;
          btn.disabled = true;
          try {
            await revogarAcesso(email);
            carregarLista();
          } catch (err) {
            alert("Não foi possível remover: " + err.message);
            btn.disabled = false;
          }
        });
      });
      elLista.querySelector("#acessos-btn-importar")?.addEventListener("click", async (e) => {
        e.target.disabled = true; e.target.textContent = "Importando…";
        try {
          for (const email of faltando) await liberarAcesso(email, usuarioAtual().email);
          carregarLista();
        } catch (err) {
          alert("Não foi possível importar: " + err.message);
          e.target.disabled = false; e.target.textContent = "Importar lista antiga";
        }
      });
    } catch (err) {
      console.error(err);
      elLista.innerHTML = `<span class="muted">${msgErro(err)}</span>`;
    }
  }

  app.querySelector("#acessos-form-liberar").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = app.querySelector("#acessos-novo-email");
    const status = app.querySelector("#acessos-liberar-status");
    const email = input.value.trim().toLowerCase();
    if (!email || !email.includes("@")) { status.textContent = "Digite um e-mail válido."; return; }
    status.textContent = "Liberando…";
    try {
      await liberarAcesso(email, usuarioAtual().email);
      input.value = "";
      status.textContent = `✓ ${email} liberado.`;
      carregarLista();
    } catch (err) {
      status.textContent = "✗ Erro: " + err.message;
    }
  });

  carregarPedidos();
  carregarLista();
}
