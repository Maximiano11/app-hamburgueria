class SistemaHamburgueria {
  constructor() {
    this.pedidos = [];
    this.proximoNumero = 1;
    this.init();
  }

  init() {
    this.atualizarEstatisticas();
    this.renderizarPedidos();
  }

  criarPedido(dadosPedido) {
    const pedido = {
      numero: this.proximoNumero++,
      ...dadosPedido,
      status: "pendente",
      timestamp: new Date().toLocaleString("pt-BR"),
      timestampPreparo: null,
      timestampConcluido: null,
    };
    this.pedidos.push(pedido);
    this.atualizarEstatisticas();
    this.renderizarPedidos();
    return pedido;
  }

  atualizarStatusPedido(numero, novoStatus) {
    const pedido = this.pedidos.find((p) => p.numero === numero);
    if (pedido) {
      pedido.status = novoStatus;
      if (novoStatus === "preparo")
        pedido.timestampPreparo = new Date().toLocaleString("pt-BR");
      else if (novoStatus === "concluido")
        pedido.timestampConcluido = new Date().toLocaleString("pt-BR");
      this.atualizarEstatisticas();
      this.renderizarPedidos();
    }
  }

  atualizarEstatisticas() {
    const total = this.pedidos.length;
    const pendentes = this.pedidos.filter(
      (p) => p.status === "pendente"
    ).length;
    const preparo = this.pedidos.filter((p) => p.status === "preparo").length;
    const concluidos = this.pedidos.filter(
      (p) => p.status === "concluido"
    ).length;

    document.getElementById("totalPedidos").textContent = total;
    document.getElementById("pedidosPendentes").textContent = pendentes;
    document.getElementById("pedidosPreparo").textContent = preparo;
    document.getElementById("pedidosConcluidos").textContent = concluidos;
    document.getElementById("prontoEntrega").textContent = concluidos;
  }

  renderizarPedidos() {
    this.renderizarPedidosCozinha();
    this.renderizarPedidosDespachante();
  }

  renderizarPedidosCozinha() {
    const container = document.getElementById("pedidosCozinha");
    const pedidosCozinha = this.pedidos
      .filter((p) => p.status !== "concluido")
      .sort((a, b) => a.numero - b.numero);

    if (pedidosCozinha.length === 0) {
      container.innerHTML = `<div class="empty-state"><div style="font-size:4em;margin-bottom:20px;">🍳</div><h3>Nenhum pedido pendente</h3><p>Todos os pedidos estão concluídos!</p></div>`;
      return;
    }

    container.innerHTML = pedidosCozinha
      .map(
        (pedido) => `
        <div class="order-card">
            <div class="order-header">
                <span class="order-number">#${pedido.numero}</span>
                <span class="order-status status-${pedido.status}">${pedido.status}</span>
            </div>
            <div class="order-info">
                <p><strong>Cliente:</strong> ${pedido.nomeCliente}</p>
                <p><strong>Combos:</strong> ${pedido.quantidadeCombos}</p>
                <p><strong>Refrigerante:</strong> ${pedido.refrigerante}</p>
                <p><strong>Obs:</strong> ${pedido.observacoes}</p>
            </div>
            <div class="status-buttons">
                ${pedido.status === "pendente" ? `<button class="btn-small btn-preparo" onclick="sistema.atualizarStatusPedido(${pedido.numero},'preparo')">Em Preparo</button>` : ""}
                ${pedido.status !== "concluido" ? `<button class="btn-small btn-concluido" onclick="sistema.atualizarStatusPedido(${pedido.numero},'concluido')">Concluído</button>` : ""}
            </div>
        </div>`
      )
      .join("");
  }

  renderizarPedidosDespachante() {
    const container = document.getElementById("pedidosDespachante");
    const pedidosConcluidos = this.pedidos
      .filter((p) => p.status === "concluido")
      .sort((a, b) => a.numero - b.numero);

    if (pedidosConcluidos.length === 0) {
      container.innerHTML = `<div class="empty-state"><div style="font-size:4em;margin-bottom:20px;">🚚</div><h3>Nenhum pedido pronto</h3><p>Aguarde os pedidos serem concluídos!</p></div>`;
      return;
    }

    container.innerHTML = pedidosConcluidos
      .map(
        (pedido) => `
        <div class="order-card">
            <div class="order-header">
                <span class="order-number">#${pedido.numero}</span>
                <span class="order-status status-${pedido.status}">${pedido.status}</span>
            </div>
            <div class="order-info">
                <p><strong>Cliente:</strong> ${pedido.nomeCliente}</p>
                <p><strong>Combos:</strong> ${pedido.quantidadeCombos}</p>
                <p><strong>Refrigerante:</strong> ${pedido.refrigerante}</p>
                <p><strong>Obs:</strong> ${pedido.observacoes}</p>
            </div>
        </div>`
      )
      .join("");
  }
}

const sistema = new SistemaHamburgueria();

// ========================
// Login / Logout
// ========================
function loginUsuario(role) {
  localStorage.setItem("usuarioLogado", role);
  atualizarInterface();
}

function logoutUsuario() {
  localStorage.removeItem("usuarioLogado");
  atualizarInterface();
}

function atualizarInterface() {
  const role = localStorage.getItem("usuarioLogado");
  const loginScreen = document.getElementById("loginScreen");
  if (!role) {
    loginScreen.classList.add("active");
    document.querySelectorAll(".panel").forEach((p) => {
      if (p.id !== "loginScreen") p.classList.remove("active");
    });
    return;
  }
  loginScreen.classList.remove("active");
  switchPanel(role);
}

// ========================
// Alternar painéis por função
// ========================
function switchPanel(panelName) {
  const role = localStorage.getItem("usuarioLogado");
  if (!role || panelName !== role) {
    alert("Acesso negado!");
    return;
  }
  document
    .querySelectorAll(".user-btn")
    .forEach((btn) => btn.classList.remove("active"));
  document
    .querySelectorAll(".panel")
    .forEach((panel) => panel.classList.remove("active"));
  document.getElementById(panelName).classList.add("active");
}

// ========================
// Criar pedidos
// ========================
function criarPedido(event) {
  event.preventDefault();
  const dadosPedido = {
    nomeCliente: document.getElementById("nomeCliente").value,
    quantidadeCombos: parseInt(
      document.getElementById("quantidadeCombos").value
    ),
    refrigerante: document.getElementById("refrigerante").value,
    observacoes: document.getElementById("observacoes").value,
  };
  sistema.criarPedido(dadosPedido);
  document.getElementById("pedidoForm").reset();
}

// ========================
// Inicializa interface
// ========================
atualizarInterface();
