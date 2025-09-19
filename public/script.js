const socket = io();

let token = null;
let role = null;

// Login
document.getElementById("login-btn").addEventListener("click", async () => {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok) {
      token = data.token;
      role = data.role;
      document.getElementById("login-panel").style.display = "none";
      document.getElementById("app-panel").style.display = "block";
      document.getElementById("user-role").textContent = role;

      showPanel(role);
      fetchPedidos();
    } else {
      document.getElementById("login-error").textContent = data.error;
    }
  } catch (err) {
    console.error(err);
  }
});

// Logout
document.getElementById("logout-btn").addEventListener("click", () => {
  token = null;
  role = null;
  document.getElementById("app-panel").style.display = "none";
  document.getElementById("login-panel").style.display = "block";
});

// Exibir painel correto
function showPanel(role) {
  if (role === "atendente")
    document.getElementById("atendente-panel").style.display = "block";
  if (role === "cozinha")
    document.getElementById("cozinha-panel").style.display = "block";
  if (role === "despachante")
    document.getElementById("despachante-panel").style.display = "block";
  if (role === "admin")
    document.getElementById("admin-panel").style.display = "block";
}

// Criar combos inputs
document.getElementById("num-combos").addEventListener("input", () => {
  const container = document.getElementById("combos-container");
  container.innerHTML = "";
  const num = parseInt(document.getElementById("num-combos").value);
  for (let i = 1; i <= num; i++) {
    const div = document.createElement("div");
    div.innerHTML = `
      <input type="text" placeholder="Nome do Combo ${i}" class="combo-nome">
      <select class="combo-refri">
        <option value="Coca-Cola">Coca-Cola</option>
        <option value="Coca-Zero">Coca-Zero</option>
        <option value="Guaraná">Guaraná</option>
      </select>
    `;
    container.appendChild(div);
  }
});

// Criar pedido
document
  .getElementById("criar-pedido-btn")
  .addEventListener("click", async () => {
    const cliente = document.getElementById("cliente").value;
    const combosDiv = document.querySelectorAll("#combos-container div");
    const combos = Array.from(combosDiv).map((div) => ({
      nomeCombo: div.querySelector(".combo-nome").value,
      refrigerante: div.querySelector(".combo-refri").value,
    }));

    try {
      const res = await fetch("/pedidos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cliente, combos }),
      });
      const data = await res.json();
      if (res.ok) {
        alert("Pedido registrado!");
        fetchPedidos();
      } else alert(data.error);
    } catch (err) {
      console.error(err);
    }
  });

// Buscar pedidos
async function fetchPedidos() {
  try {
    const res = await fetch("/pedidos", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const pedidos = await res.json();
    renderPedidos(pedidos);
  } catch (err) {
    console.error(err);
  }
}

// Renderizar pedidos
function renderPedidos(pedidos) {
  const cozinhaDiv = document.getElementById("pedidos-cozinha");
  const despachanteDiv = document.getElementById("pedidos-despachante");
  const adminDiv = document.getElementById("pedidos-admin");

  if (cozinhaDiv) cozinhaDiv.innerHTML = "";
  if (despachanteDiv) despachanteDiv.innerHTML = "";
  if (adminDiv) adminDiv.innerHTML = "";

  pedidos.forEach((p) => {
    const combos = JSON.parse(p.combos);
    const text = `Pedido #${p.numero} - ${p.cliente} - ${combos.map((c) => `${c.nomeCombo} (${c.refrigerante})`).join(", ")} - Status: ${p.status}`;

    if (
      role === "cozinha" &&
      (p.status === "pendente" || p.status === "em preparo")
    ) {
      const div = document.createElement("div");
      div.textContent = text;
      if (p.status === "pendente") {
        const btn = document.createElement("button");
        btn.textContent = "Em preparo";
        btn.onclick = () => atualizarStatus(p.numero, "em preparo");
        div.appendChild(btn);
      }
      if (p.status === "em preparo") {
        const btn = document.createElement("button");
        btn.textContent = "Concluído";
        btn.onclick = () => atualizarStatus(p.numero, "concluido");
        div.appendChild(btn);
      }
      cozinhaDiv.appendChild(div);
    }

    if (role === "despachante" && p.status === "concluido") {
      const div = document.createElement("div");
      div.textContent = text;
      const btn = document.createElement("button");
      btn.textContent = "Entregue";
      btn.onclick = () => atualizarStatus(p.numero, "entregue");
      div.appendChild(btn);
      despachanteDiv.appendChild(div);
    }

    if (role === "admin") {
      const div = document.createElement("div");
      div.textContent = text;
      adminDiv.appendChild(div);
    }
  });
}

// Atualizar status
async function atualizarStatus(numero, status) {
  try {
    const res = await fetch(`/pedidos/${numero}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (res.ok) fetchPedidos();
    else alert(data.error);
  } catch (err) {
    console.error(err);
  }
}

// Socket.IO eventos
socket.on("novo-pedido", fetchPedidos);
socket.on("atualizacao-pedido", fetchPedidos);
