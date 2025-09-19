// script.js

const socket = io("https://hamburgueria-mezu.onrender.com");

let token = localStorage.getItem("token");
let role = localStorage.getItem("role");

// ----- ELEMENTOS -----
const loginDiv = document.getElementById("loginDiv");
const appDiv = document.getElementById("appDiv");

const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");

const logoutBtn = document.getElementById("logoutBtn");

const atendenteForm = document.getElementById("atendenteForm");
const clienteInput = document.getElementById("cliente");
const quantidadeInput = document.getElementById("quantidade");
const refrigerantesContainer = document.getElementById(
  "refrigerantesContainer"
);
const observacoesInput = document.getElementById("observacoes");
const criarPedidoBtn = document.getElementById("criarPedidoBtn");

const pedidosContainer = document.getElementById("pedidosContainer");

// ----- LOGIN -----
loginBtn.onclick = async () => {
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
      localStorage.setItem("token", token);
      localStorage.setItem("role", role);
      iniciarApp();
    } else {
      alert(data.error);
    }
  } catch (err) {
    alert("Erro ao conectar com o servidor");
    console.error(err);
  }
};

// ----- LOGOUT -----
logoutBtn.onclick = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  location.reload();
};

// ----- INICIAR APP -----
function iniciarApp() {
  loginDiv.style.display = "none";
  appDiv.style.display = "block";

  // Mostrar formulário apenas para atendente e admin
  if (role === "atendente" || role === "admin") {
    atendenteForm.style.display = "block";
    criarRefrigerantesInputs();
  } else {
    atendenteForm.style.display = "none";
  }

  carregarPedidos();

  // Socket.IO para atualizar pedidos em tempo real
  socket.on("atualizarPedidos", () => {
    carregarPedidos();
  });
}

// ----- CRIAR CAMPOS DE REFRIGERANTE -----
function criarRefrigerantesInputs() {
  refrigerantesContainer.innerHTML = "";
  const quantidade = parseInt(quantidadeInput.value || 1);

  for (let i = 0; i < quantidade; i++) {
    const select = document.createElement("select");
    select.name = "refrigerante";
    select.innerHTML = `
      <option value="Coca-Cola">Coca-Cola</option>
      <option value="Coca-Zero">Coca-Zero</option>
      <option value="Guaraná">Guaraná</option>
    `;
    refrigerantesContainer.appendChild(select);
  }
}

quantidadeInput.onchange = criarRefrigerantesInputs;

// ----- CRIAR PEDIDO -----
criarPedidoBtn.onclick = async () => {
  const refrigerantesEscolhidos = Array.from(
    refrigerantesContainer.querySelectorAll("select")
  ).map((s) => s.value);

  const payload = {
    cliente: clienteInput.value,
    quantidade: parseInt(quantidadeInput.value),
    refrigerantes: refrigerantesEscolhidos,
    observacoes: observacoesInput.value,
  };

  try {
    const res = await fetch("https://hamburgueria-mezu.onrender.com/pedidos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (res.ok) {
      clienteInput.value = "";
      quantidadeInput.value = 1;
      observacoesInput.value = "";
      criarRefrigerantesInputs();
      alert("Pedido criado com sucesso!");
      socket.emit("novoPedido");
    } else {
      alert(data.error);
    }
  } catch (err) {
    console.error(err);
    alert("Erro ao criar pedido");
  }
};

// ----- CARREGAR PEDIDOS -----
async function carregarPedidos() {
  try {
    const res = await fetch("https://hamburgueria-mezu.onrender.com/pedidos", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Erro ao carregar pedidos");

    const pedidos = data.orders || []; // array de pedidos
    const items = data.items || []; // array de itens por pedido

    atualizarUI(pedidos, items);
  } catch (err) {
    console.error(err);
    alert("Erro ao carregar pedidos");
  }
}

// ----- ATUALIZAR UI -----
function atualizarUI(pedidos, items) {
  pedidosContainer.innerHTML = "";

  pedidos.forEach((pedido) => {
    const div = document.createElement("div");
    div.classList.add("pedidoCard");

    const pedidoItems = items
      .filter((i) => i.order_id === pedido.id)
      .map((i) => `Combo ${i.item_index + 1}: ${i.refrigerante}`)
      .join("<br>");

    let botoes = "";

    // Cozinha
    if (
      (role === "cozinha" || role === "admin") &&
      pedido.status === "pendente"
    ) {
      botoes = `<button class="btn" onclick="atualizarStatus(${pedido.id}, 'em preparo')">Receber e preparar</button>`;
    }
    if (
      (role === "cozinha" || role === "admin") &&
      pedido.status === "em preparo"
    ) {
      botoes = `<button class="btn" onclick="atualizarStatus(${pedido.id}, 'concluido')">Marcar como concluído</button>`;
    }

    // Despachante
    if (
      (role === "despachante" || role === "admin") &&
      pedido.status === "concluido"
    ) {
      botoes = `<button class="btn" onclick="atualizarStatus(${pedido.id}, 'entregue')">Marcar como entregue</button>`;
    }

    div.innerHTML = `
      <h3>Pedido #${pedido.numero}</h3>
      <p>Cliente: ${pedido.cliente}</p>
      <p>Status: ${pedido.status}</p>
      <p>${pedidoItems}</p>
      <p>Observações: ${pedido.observacoes || ""}</p>
      ${botoes}
    `;

    pedidosContainer.appendChild(div);
  });
}

// ----- ATUALIZAR STATUS -----
async function atualizarStatus(orderId, status) {
  try {
    const res = await fetch(
      `https://hamburgueria-mezu.onrender.com/pedidos/${orderId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      }
    );

    const data = await res.json();

    if (res.ok) {
      socket.emit("novoPedido"); // atualizar em tempo real
      carregarPedidos();
    } else {
      alert(data.error);
    }
  } catch (err) {
    console.error(err);
    alert("Erro ao atualizar status");
  }
}

// ----- INICIAR -----
if (token && role) iniciarApp();
