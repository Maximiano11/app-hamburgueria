const socket = io();
let token = null;
let role = null;

// Login
document.getElementById("btnLogin").addEventListener("click", async () => {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (res.ok) {
    token = data.token;
    role = data.role;
    document.getElementById("loginPanel").style.display = "none";
    document.getElementById("mainPanel").style.display = "block";
    carregarPedidos();
  } else {
    document.getElementById("loginError").textContent = data.error;
  }
});

// Logout
document.getElementById("btnLogout").addEventListener("click", () => {
  token = null;
  role = null;
  document.getElementById("mainPanel").style.display = "none";
  document.getElementById("loginPanel").style.display = "block";
});

// Switch panel
function switchPanel(panel) {
  document
    .querySelectorAll(".panel")
    .forEach((p) => p.classList.remove("active"));
  document.getElementById(panel).classList.add("active");
}

// Criar pedido
document.getElementById("pedidoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (role !== "atendente")
    return alert("Somente atendente pode criar pedidos");

  const pedido = {
    cliente: document.getElementById("nomeCliente").value,
    combos: document.getElementById("quantidadeCombos").value,
    refrigerante: document.getElementById("refrigerante").value,
    observacoes: document.getElementById("observacoes").value,
  };

  const res = await fetch("/pedidos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify(pedido),
  });
  if (res.ok) {
    document.getElementById("pedidoForm").reset();
  }
});

// Carregar pedidos iniciais
async function carregarPedidos() {
  const res = await fetch("/pedidos", {
    headers: { Authorization: "Bearer " + token },
  });
  const pedidos = await res.json();
  atualizarPedidos(pedidos);
}

// Atualizar pedidos na tela
function atualizarPedidos(pedidos) {
  const pedidosCozinha = document.getElementById("pedidosCozinha");
  const pedidosDespachante = document.getElementById("pedidosDespachante");
  pedidosCozinha.innerHTML = "";
  pedidosDespachante.innerHTML = "";

  pedidos.forEach((p) => {
    const div = document.createElement("div");
    div.className = "pedido";
    div.innerHTML = `<strong>#${p.numero} - ${p.cliente}</strong> | ${p.combos} combos | ${p.refrigerante} | ${p.status}`;

    // Cozinha
    if (role === "cozinha") {
      if (p.status === "pendente") {
        const btnPreparo = document.createElement("button");
        btnPreparo.textContent = "Em preparo";
        btnPreparo.onclick = () => atualizarStatus(p.numero, "preparo");
        div.appendChild(btnPreparo);
      }
      if (p.status === "preparo") {
        const btnConcluido = document.createElement("button");
        btnConcluido.textContent = "Concluído";
        btnConcluido.onclick = () => atualizarStatus(p.numero, "concluido");
        div.appendChild(btnConcluido);
      }
      pedidosCozinha.appendChild(div);
    }

    // Despachante
    if (role === "despachante") {
      if (p.status === "concluido") {
        const btnEntregar = document.createElement("button");
        btnEntregar.textContent = "Entregue";
        btnEntregar.onclick = () => atualizarStatus(p.numero, "entregue");
        div.appendChild(btnEntregar);
      }
      pedidosDespachante.appendChild(div);
    }
  });
}

// Atualizar status do pedido
async function atualizarStatus(numero, status) {
  await fetch(`/pedidos/${numero}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify({ status }),
  });
}

// Socket.IO eventos em tempo real
socket.on("novoPedido", (pedido) => carregarPedidos());
socket.on("atualizarPedido", (pedido) => carregarPedidos());
