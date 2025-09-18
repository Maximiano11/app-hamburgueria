const socket = io();
let currentUser = null;

// Login
const loginForm = document.getElementById("loginForm");
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (res.ok) {
    const data = await res.json();
    currentUser = data;
    document.querySelector(".login-container").style.display = "none";
    document.querySelector(".container").style.display = "block";
    alert("Login realizado como " + data.role);
  } else {
    document.getElementById("loginError").textContent =
      "Usuário ou senha inválidos";
  }
});

// Logout
function logout() {
  currentUser = null;
  document.querySelector(".login-container").style.display = "block";
  document.querySelector(".container").style.display = "none";
}

// Troca de painel
function switchPanel(panel) {
  document
    .querySelectorAll(".panel")
    .forEach((p) => p.classList.remove("active"));
  document.getElementById(panel).classList.add("active");
}

// Criar pedido
const pedidoForm = document.getElementById("pedidoForm");
pedidoForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!currentUser || currentUser.role !== "atendente")
    return alert("Sem permissão");
  const pedido = {
    cliente: document.getElementById("cliente").value,
    combos: document.getElementById("combos").value,
    refrigerante: document.getElementById("refrigerante").value,
    observacoes: document.getElementById("observacoes").value,
  };
  socket.emit("criar-pedido", pedido);
  pedidoForm.reset();
});

// Recebe pedidos em tempo real
socket.on("pedidos-atualizados", (pedidos) => {
  // Atendente
  const aContainer = document.getElementById("pedidosAtendente");
  aContainer.innerHTML = pedidos
    .map(
      (p) => `
        <div class="order-card">
            <p><strong>#${p.numero}</strong> ${p.cliente}</p>
            <p>${p.combos} combos - ${p.refrigerante}</p>
            <p>${p.observacoes || ""}</p>
            <p>Status: ${p.status}</p>
        </div>
    `
    )
    .join("");

  // Cozinha
  const cContainer = document.getElementById("pedidosCozinha");
  cContainer.innerHTML = pedidos
    .filter((p) => p.status !== "concluido")
    .map(
      (p) => `
        <div class="order-card">
            <p><strong>#${p.numero}</strong> ${p.cliente}</p>
            <p>${p.combos} combos - ${p.refrigerante}</p>
            <p>${p.observacoes || ""}</p>
            <p>Status: ${p.status}</p>
            ${currentUser && currentUser.role === "cozinha" ? `<button onclick="atualizarStatus(${p.numero}, 'concluido')">Marcar como pronto</button>` : ""}
        </div>
    `
    )
    .join("");

  // Despachante
  const dContainer = document.getElementById("pedidosDespachante");
  dContainer.innerHTML = pedidos
    .filter((p) => p.status === "concluido")
    .map(
      (p) => `
        <div class="order-card">
            <p><strong>#${p.numero}</strong> ${p.cliente}</p>
            <p>${p.combos} combos - ${p.refrigerante}</p>
            <p>${p.observacoes || ""}</p>
        </div>
    `
    )
    .join("");
});

// Atualiza status (cozinha)
function atualizarStatus(numero, status) {
  socket.emit("atualizar-status", { numero, status });
}
