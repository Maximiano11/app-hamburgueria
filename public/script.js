const socket = io();
let token = "";
let role = "";

const loginPanel = document.getElementById("login-panel");
const mainPanel = document.getElementById("main-panel");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const loginError = document.getElementById("login-error");
const welcomeMsg = document.getElementById("welcome-msg");

// Painéis por role
const atendentePanel = document.getElementById("atendente-panel");
const cozinhaPanel = document.getElementById("cozinha-panel");
const despachantePanel = document.getElementById("despachante-panel");
const adminPanel = document.getElementById("admin-panel");

// Atendente inputs
const clienteInput = document.getElementById("cliente");
const combosInput = document.getElementById("combos");
const observacoesInput = document.getElementById("observacoes");
const refrigerantesContainer = document.getElementById(
  "refrigerantes-container"
);
const criarPedidoBtn = document.getElementById("criar-pedido-btn");

// Containers de pedidos
const atendenteOrders = document.getElementById("atendente-orders");
const cozinhaPendentes = document.getElementById("cozinha-pendentes");
const cozinhaPreparo = document.getElementById("cozinha-preparo");
const despachanteOrders = document.getElementById("despachante-orders");
const adminOrders = document.getElementById("admin-orders");

// Refrigerantes disponíveis
const refrigerantesList = ["Coca-Cola", "Coca-Zero", "Guaraná"];

function gerarRefrigerantesInputs() {
  refrigerantesContainer.innerHTML = "";
  const qtd = parseInt(combosInput.value) || 1;
  for (let i = 0; i < qtd; i++) {
    const div = document.createElement("div");
    div.innerHTML = `<label>Combo ${i + 1} Refrigerante:</label>
      <select class="refrigerante">
        ${refrigerantesList.map((r) => `<option value="${r}">${r}</option>`).join("")}
      </select>`;
    refrigerantesContainer.appendChild(div);
  }
}

combosInput.addEventListener("change", gerarRefrigerantesInputs);
window.onload = gerarRefrigerantesInputs;

// ===== Login =====
loginBtn.onclick = async () => {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    loginError.textContent = data.error;
    return;
  }

  token = data.token;
  role = data.role;
  loginPanel.classList.add("hidden");
  mainPanel.classList.remove("hidden");
  welcomeMsg.textContent = `Bem-vindo, ${username} (${role})`;

  mostrarPainel(role);
};

// Logout
logoutBtn.onclick = () => {
  token = "";
  role = "";
  mainPanel.classList.add("hidden");
  loginPanel.classList.remove("hidden");
};

// Mostrar painel correto
function mostrarPainel(role) {
  atendentePanel.classList.add("hidden");
  cozinhaPanel.classList.add("hidden");
  despachantePanel.classList.add("hidden");
  adminPanel.classList.add("hidden");

  if (role === "atendente") atendentePanel.classList.remove("hidden");
  else if (role === "cozinha") cozinhaPanel.classList.remove("hidden");
  else if (role === "despachante") despachantePanel.classList.remove("hidden");
  else if (role === "admin") adminPanel.classList.remove("hidden");
}

// ===== Criar pedido =====
criarPedidoBtn.onclick = async () => {
  const cliente = clienteInput.value;
  const observacoes = observacoesInput.value;
  const combos = parseInt(combosInput.value);
  const refrigerantes = Array.from(
    document.querySelectorAll(".refrigerante")
  ).map((s) => s.value);

  if (!cliente || combos < 1)
    return alert("Preencha o nome do cliente e quantidade de combos");

  await fetch("/pedidos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ cliente, combos, refrigerantes, observacoes }),
  });

  clienteInput.value = "";
  observacoesInput.value = "";
  combosInput.value = 1;
  gerarRefrigerantesInputs();
};

// ===== Receber updates em tempo real =====
socket.on("update", (orders) => {
  // Limpar todos
  atendenteOrders.innerHTML = "";
  cozinhaPendentes.innerHTML = "";
  cozinhaPreparo.innerHTML = "";
  despachanteOrders.innerHTML = "";
  adminOrders.innerHTML = "";

  orders.forEach((order) => {
    const div = document.createElement("div");
    div.classList.add("order-card");
    div.innerHTML = `<h4>Pedido #${order.numero}</h4>
      <p><strong>Cliente:</strong> ${order.cliente}</p>
      <p><strong>Status:</strong> ${order.status}</p>
      <p><strong>Observações:</strong> ${order.observacoes || "-"}</p>
      <p><strong>Refrigerantes:</strong> ${order.refrigerantes ? order.refrigerantes.join(", ") : "-"}</p>`;

    // Botões de ação por role
    if (role === "cozinha") {
      if (order.status === "pendente") {
        const btn = document.createElement("button");
        btn.textContent = "Em Preparo";
        btn.onclick = () => atualizarStatus(order.numero, "em preparo");
        div.appendChild(btn);
        cozinhaPendentes.appendChild(div);
      } else if (order.status === "em preparo") {
        const btn = document.createElement("button");
        btn.textContent = "Concluído";
        btn.onclick = () => atualizarStatus(order.numero, "concluido");
        div.appendChild(btn);
        cozinhaPreparo.appendChild(div);
      }
    } else if (role === "despachante" && order.status === "concluido") {
      const btn = document.createElement("button");
      btn.textContent = "Entregue";
      btn.onclick = () => atualizarStatus(order.numero, "entregue");
      div.appendChild(btn);
      despachanteOrders.appendChild(div);
    } else if (role === "atendente") {
      atendenteOrders.appendChild(div);
    } else if (role === "admin") {
      adminOrders.appendChild(div);
    }
  });
});

async function atualizarStatus(numero, status) {
  await fetch(`/pedidos/${numero}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });
}
