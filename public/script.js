const socket = io("https://hamburgueria-mezu.onrender.com");

// ----- SUPABASE -----
const SUPABASE_URL = "https://krybnbkjuwhpjhykfjeb.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeWJuYmtqdXdocGpoeWtmamViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMTk2NDIsImV4cCI6MjA3Mzc5NTY0Mn0.1bGQXR4TOavZrqXMlsDCyh7q25tQ1bN81kXqseuoqRo";

// ----- ELEMENTOS -----
const loginPanel = document.getElementById("login-panel");
const mainPanel = document.getElementById("main-panel");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginError = document.getElementById("login-error");
const userRoleSpan = document.getElementById("user-role");

const atendentePanel = document.getElementById("atendente-panel");
const cozinhaPanel = document.getElementById("cozinha-panel");
const despachantePanel = document.getElementById("despachante-panel");
const adminPanel = document.getElementById("admin-panel");

const clienteInput = document.getElementById("cliente");
const combosInput = document.getElementById("combos");
const refrigerantesContainer = document.getElementById(
  "refrigerantes-container"
);
const criarPedidoBtn = document.getElementById("criar-pedido-btn");

const cozinhaPedidos = document.getElementById("cozinha-pedidos");
const despachantePedidos = document.getElementById("despachante-pedidos");
const adminPedidos = document.getElementById("admin-pedidos");

// ----- LOGIN -----
let token = "";
let role = "";

loginBtn.addEventListener("click", async () => {
  const username = usernameInput.value;
  const password = passwordInput.value;

  try {
    const res = await fetch("https://hamburgueria-mezu.onrender.com/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok) {
      token = data.token;
      role = data.role;
      userRoleSpan.textContent = role;
      loginPanel.classList.add("hidden");
      mainPanel.classList.remove("hidden");
      mostrarPainelPorRole();
      carregarPedidos();
    } else {
      loginError.textContent = data.error;
    }
  } catch (err) {
    loginError.textContent = "Erro ao conectar ao servidor";
  }
});

logoutBtn.addEventListener("click", () => {
  token = "";
  role = "";
  loginPanel.classList.remove("hidden");
  mainPanel.classList.add("hidden");
});

// ----- ATENDENTE -----
function mostrarPainelPorRole() {
  atendentePanel.classList.add("hidden");
  cozinhaPanel.classList.add("hidden");
  despachantePanel.classList.add("hidden");
  adminPanel.classList.add("hidden");

  if (role === "atendente") atendentePanel.classList.remove("hidden");
  if (role === "cozinha") cozinhaPanel.classList.remove("hidden");
  if (role === "despachante") despachantePanel.classList.remove("hidden");
  if (role === "admin") adminPanel.classList.remove("hidden");
}

// Criar campos de refrigerante conforme quantidade de combos
combosInput.addEventListener("input", () => {
  const qtd = parseInt(combosInput.value) || 1;
  refrigerantesContainer.innerHTML = "";
  for (let i = 0; i < qtd; i++) {
    const select = document.createElement("select");
    select.innerHTML = `
      <option value="Coca-Cola">Coca-Cola</option>
      <option value="Coca-Zero">Coca-Zero</option>
      <option value="Guarana">Guaraná</option>
    `;
    refrigerantesContainer.appendChild(select);
  }
});

criarPedidoBtn.addEventListener("click", async () => {
  const cliente = clienteInput.value;
  const combos = parseInt(combosInput.value);
  const refrigerantes = Array.from(
    refrigerantesContainer.querySelectorAll("select")
  ).map((sel) => sel.value);

  try {
    await fetch("https://hamburgueria-mezu.onrender.com/pedidos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ cliente, combos, refrigerantes }),
    });
    clienteInput.value = "";
    combosInput.value = "1";
    refrigerantesContainer.innerHTML = "";
  } catch (err) {
    alert("Erro ao criar pedido");
  }
});

// ----- SOCKET.IO -----
socket.on("update", (orders) => {
  // Limpa
  cozinhaPedidos.innerHTML = "";
  despachantePedidos.innerHTML = "";
  adminPedidos.innerHTML = "";

  orders.forEach((pedido) => {
    const card = document.createElement("div");
    card.classList.add("pedido-card");
    card.innerHTML = `<h4>Pedido #${pedido.numero} - ${pedido.cliente}</h4>
      <p>Status: ${pedido.status}</p>`;

    if (role === "cozinha" && pedido.status === "pendente") {
      const btn = document.createElement("button");
      btn.textContent = "Em preparo";
      btn.onclick = () => atualizarStatus(pedido.numero, "em preparo");
      card.appendChild(btn);
    }
    if (role === "cozinha" && pedido.status === "em preparo") {
      const btn = document.createElement("button");
      btn.textContent = "Concluído";
      btn.onclick = () => atualizarStatus(pedido.numero, "concluido");
      card.appendChild(btn);
    }
    if (role === "despachante" && pedido.status === "concluido") {
      const btn = document.createElement("button");
      btn.textContent = "Entregue";
      btn.onclick = () => atualizarStatus(pedido.numero, "entregue");
      card.appendChild(btn);
    }

    if (role === "cozinha") cozinhaPedidos.appendChild(card);
    if (role === "despachante") despachantePedidos.appendChild(card);
    if (role === "admin") adminPedidos.appendChild(card);
    if (role === "atendente") adminPedidos.appendChild(card);
  });
});

async function atualizarStatus(numero, status) {
  await fetch(`https://hamburgueria-mezu.onrender.com/pedidos/${numero}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });
}
