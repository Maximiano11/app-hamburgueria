const socket = io(); // conecta ao Socket.IO

let token = null;
let role = null;

// Elementos
const loginPanel = document.getElementById("login-panel");
const appPanel = document.getElementById("app-panel");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginError = document.getElementById("login-error");

const userRoleSpan = document.getElementById("user-role");
const atendentePanel = document.getElementById("atendente-panel");
const createOrderBtn = document.getElementById("create-order");
const pedidosList = document.getElementById("pedidos-list");
const combosInput = document.getElementById("combos");
const clienteInput = document.getElementById("cliente");
const refrigerantesContainer = document.getElementById(
  "refrigerantes-container"
);

const REFRIGERANTES = ["Coca-Cola", "Coca-Zero", "Guaraná"];

// LOGIN
loginBtn.addEventListener("click", async () => {
  const username = usernameInput.value;
  const password = passwordInput.value;

  try {
    const res = await fetch("https://seu-backend.onrender.com/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok) {
      token = data.token;
      role = data.role;
      afterLogin();
    } else {
      loginError.textContent = data.error;
    }
  } catch (err) {
    loginError.textContent = "Erro ao conectar ao servidor.";
  }
});

function afterLogin() {
  loginPanel.classList.add("hidden");
  appPanel.classList.remove("hidden");
  userRoleSpan.textContent = role;

  if (role === "atendente" || role === "admin") {
    atendentePanel.classList.remove("hidden");
  }

  fetchPedidos();
}

// LOGOUT
logoutBtn.addEventListener("click", () => {
  token = null;
  role = null;
  appPanel.classList.add("hidden");
  loginPanel.classList.remove("hidden");
});

// CRIAR REFRIGERANTES DINÂMICOS
combosInput.addEventListener("input", () => {
  const quantidade = parseInt(combosInput.value) || 0;
  refrigerantesContainer.innerHTML = "";
  for (let i = 0; i < quantidade; i++) {
    const select = document.createElement("select");
    select.innerHTML = REFRIGERANTES.map(
      (r) => `<option value="${r}">${r}</option>`
    ).join("");
    select.dataset.index = i;
    refrigerantesContainer.appendChild(select);
  }
});

// CRIAR PEDIDO
createOrderBtn.addEventListener("click", async () => {
  const cliente = clienteInput.value;
  const combos = parseInt(combosInput.value);
  const refrigerantes = Array.from(
    refrigerantesContainer.querySelectorAll("select")
  ).map((s) => s.value);

  if (!cliente || combos < 1) return alert("Preencha todos os campos");

  try {
    const res = await fetch("https://seu-backend.onrender.com/pedidos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ cliente, combos, refrigerantes }),
    });
    const data = await res.json();
    if (res.ok) {
      socket.emit("pedidoCriado", data.pedido);
      clienteInput.value = "";
      combosInput.value = "";
      refrigerantesContainer.innerHTML = "";
    } else {
      alert(data.error);
    }
  } catch (err) {
    alert("Erro ao criar pedido.");
  }
});

// BUSCAR PEDIDOS
async function fetchPedidos() {
  try {
    const res = await fetch("https://seu-backend.onrender.com/pedidos", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const pedidos = await res.json();
    renderPedidos(pedidos);
  } catch (err) {
    console.error(err);
  }
}

// RENDER PEDIDOS
function renderPedidos(pedidos) {
  pedidosList.innerHTML = "";
  pedidos.forEach((p) => {
    const card = document.createElement("div");
    card.classList.add("order-card");
    card.classList.add(p.status.replace(" ", "-"));
    card.innerHTML = `
      <p><strong>#${p.numero}</strong> - ${p.cliente}</p>
      <p>Status: ${p.status}</p>
      <p>Itens: ${p.refrigerantes?.join(", ") || ""}</p>
    `;

    if ((role === "cozinha" || role === "admin") && p.status === "pendente") {
      const btn = document.createElement("button");
      btn.textContent = "Em preparo";
      btn.addEventListener("click", () => updateStatus(p.id, "preparing"));
      card.appendChild(btn);
    }

    if ((role === "cozinha" || role === "admin") && p.status === "preparing") {
      const btn = document.createElement("button");
      btn.textContent = "Concluído";
      btn.addEventListener("click", () => updateStatus(p.id, "completed"));
      card.appendChild(btn);
    }

    if (
      (role === "despachante" || role === "admin") &&
      p.status === "completed"
    ) {
      const btn = document.createElement("button");
      btn.textContent = "Entregue";
      btn.addEventListener("click", () => updateStatus(p.id, "delivered"));
      card.appendChild(btn);
    }

    pedidosList.appendChild(card);
  });
}

// ATUALIZAR STATUS
async function updateStatus(id, status) {
  try {
    const res = await fetch(`https://seu-backend.onrender.com/pedidos/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (res.ok) socket.emit("pedidoAtualizado", data.pedido);
    else alert(data.error);
  } catch (err) {
    alert("Erro ao atualizar status");
  }
}

// SOCKET.IO
socket.on("pedidoCriado", (pedido) => fetchPedidos());
socket.on("pedidoAtualizado", (pedido) => fetchPedidos());
