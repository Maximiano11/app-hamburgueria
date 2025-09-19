const socket = io(); // conecta ao servidor Socket.IO

// Pegando elementos do DOM
const loginPanel = document.getElementById("login-panel");
const appPanel = document.getElementById("app-panel");
const loginError = document.getElementById("login-error");
const btnLogout = document.getElementById("btnLogout");

const inputUsername = document.getElementById("username");
const inputPassword = document.getElementById("password");
const btnLogin = document.getElementById("btnLogin");

const pedidosContainer = document.getElementById("pedidos-container");
const pedidoForm = document.getElementById("pedido-form");
const inputCliente = document.getElementById("cliente");
const inputCombos = document.getElementById("combos");

// Guardar usuário logado
let currentUser = null;

// --- Login ---
btnLogin.addEventListener("click", async () => {
  const username = inputUsername.value;
  const password = inputPassword.value;

  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (res.ok) {
      currentUser = data;
      loginPanel.style.display = "none";
      appPanel.style.display = "block";
      renderPedidoForm();
      socket.emit("join", data.role);
    } else {
      loginError.textContent = data.error;
    }
  } catch (err) {
    console.error(err);
  }
});

// --- Logout ---
btnLogout.addEventListener("click", () => {
  currentUser = null;
  loginPanel.style.display = "block";
  appPanel.style.display = "none";
});

// --- Renderiza formulário de pedido só para atendente ---
function renderPedidoForm() {
  if (currentUser.role === "atendente" || currentUser.role === "admin") {
    pedidoForm.style.display = "block";
  } else {
    pedidoForm.style.display = "none";
  }
}

// --- Criar pedido ---
pedidoForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const combos = parseInt(inputCombos.value);
  const refrigerantes = [];

  for (let i = 0; i < combos; i++) {
    const ref = prompt(
      `Escolha o refrigerante para o combo ${i + 1} (Coca-Cola, Coca-Zero, Guaraná)`
    );
    refrigerantes.push(ref);
  }

  const pedidoData = {
    cliente: inputCliente.value,
    combos,
    refrigerantes,
  };

  try {
    const res = await fetch("/pedidos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentUser.token}`,
      },
      body: JSON.stringify(pedidoData),
    });
    const data = await res.json();
    if (res.ok) {
      socket.emit("novoPedido", data.pedido);
      pedidoForm.reset();
    } else {
      alert(data.error);
    }
  } catch (err) {
    console.error(err);
  }
});

// --- Renderizar pedidos ---
function renderPedidos(pedidos) {
  pedidosContainer.innerHTML = "";

  pedidos.forEach((p) => {
    const card = document.createElement("div");
    card.className = `pedido pedido-status-${p.status.replace(" ", "-")}`;
    card.innerHTML = `
      <strong>Pedido #${p.numero} - ${p.cliente}</strong>
      <p>Status: ${p.status}</p>
      <p>Combos: ${p.combos}</p>
      <p>Refrigerantes: ${p.refrigerantes.join(", ")}</p>
    `;

    // Botões de ação para cozinha e despachante
    if (
      (currentUser.role === "cozinha" || currentUser.role === "admin") &&
      p.status === "pendente"
    ) {
      const btnPreparar = document.createElement("button");
      btnPreparar.textContent = "Em Preparo";
      btnPreparar.onclick = () => atualizarStatus(p.numero, "em preparo");
      card.appendChild(btnPreparar);
    }

    if (
      (currentUser.role === "cozinha" || currentUser.role === "admin") &&
      p.status === "em preparo"
    ) {
      const btnConcluir = document.createElement("button");
      btnConcluir.textContent = "Concluído";
      btnConcluir.onclick = () => atualizarStatus(p.numero, "concluído");
      card.appendChild(btnConcluir);
    }

    if (
      (currentUser.role === "despachante" || currentUser.role === "admin") &&
      p.status === "concluído"
    ) {
      const btnEntregar = document.createElement("button");
      btnEntregar.textContent = "Entregue";
      btnEntregar.onclick = () => atualizarStatus(p.numero, "entregue");
      card.appendChild(btnEntregar);
    }

    pedidosContainer.appendChild(card);
  });
}

// --- Atualizar status ---
async function atualizarStatus(numero, status) {
  try {
    const res = await fetch(`/pedidos/${numero}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentUser.token}`,
      },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (res.ok) {
      socket.emit("atualizarPedido", data.pedido);
    } else {
      alert(data.error);
    }
  } catch (err) {
    console.error(err);
  }
}

// --- Socket.IO eventos ---
socket.on("atualizarPedidos", (pedidos) => renderPedidos(pedidos));
socket.on("novoPedido", (pedido) => {
  pedidosContainer.appendChild(createPedidoCard(pedido));
});

// --- Função auxiliar para criar card individual (usado pelo Socket) ---
function createPedidoCard(p) {
  const card = document.createElement("div");
  card.className = `pedido pedido-status-${p.status.replace(" ", "-")}`;
  card.innerHTML = `
    <strong>Pedido #${p.numero} - ${p.cliente}</strong>
    <p>Status: ${p.status}</p>
    <p>Combos: ${p.combos}</p>
    <p>Refrigerantes: ${p.refrigerantes.join(", ")}</p>
  `;
  return card;
}
