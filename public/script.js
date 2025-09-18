const socket = io();

const loginDiv = document.getElementById("loginDiv");
const appDiv = document.getElementById("appDiv");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginError = document.getElementById("loginError");
const pedidosContainer = document.getElementById("pedidosContainer");
const pedidoForm = document.getElementById("pedidoForm");

let usuarioLogado = null;

// Login
loginBtn.addEventListener("click", async () => {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error("Usuário ou senha inválidos");
    const data = await res.json();
    usuarioLogado = data.username;
    loginDiv.style.display = "none";
    appDiv.style.display = "block";
  } catch (err) {
    loginError.textContent = err.message;
  }
});

// Logout
logoutBtn.addEventListener("click", () => {
  usuarioLogado = null;
  loginDiv.style.display = "block";
  appDiv.style.display = "none";
});

// Registrar pedido
pedidoForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const pedido = {
    cliente: document.getElementById("cliente").value,
    combos: document.getElementById("combos").value,
    refrigerante: document.getElementById("refrigerante").value,
    observacoes: document.getElementById("observacoes").value,
  };

  await fetch("/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pedido),
  });

  pedidoForm.reset();
});

// Atualiza pedidos em tempo real
socket.on("todos-pedidos", (pedidos) => {
  pedidosContainer.innerHTML = pedidos
    .map(
      (p) => `
    <div class="pedido">
      <strong>#${p.numero} - ${p.cliente}</strong><br>
      Combos: ${p.combos}, Refrigerante: ${p.refrigerante}<br>
      ${p.observacoes ? `Obs: ${p.observacoes}<br>` : ""}
      Status: ${p.status} | Criado em: ${p.criadoEm}
    </div>
    <hr>
  `
    )
    .join("");
});

socket.on("novo-pedido", (pedido) => {
  pedidosContainer.innerHTML += `
    <div class="pedido">
      <strong>#${pedido.numero} - ${pedido.cliente}</strong><br>
      Combos: ${pedido.combos}, Refrigerante: ${pedido.refrigerante}<br>
      ${pedido.observacoes ? `Obs: ${pedido.observacoes}<br>` : ""}
      Status: ${pedido.status} | Criado em: ${pedido.criadoEm}
    </div>
    <hr>
  `;
});
