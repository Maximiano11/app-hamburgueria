const socket = io("https://hamburgueria-mezu.onrender.com");

let token = "";
let role = "";

// ----- LOGIN -----
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const loginPanel = document.getElementById("login-panel");
const appPanel = document.getElementById("app-panel");
const welcomeMsg = document.getElementById("welcome-msg");
const loginError = document.getElementById("login-error");

loginBtn.onclick = async () => {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

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
      loginPanel.classList.add("hidden");
      appPanel.classList.remove("hidden");
      welcomeMsg.textContent = `Bem-vindo, ${username} (${role})`;
      mostrarPainel(role);
      carregarPedidos();
    } else {
      loginError.textContent = data.error;
    }
  } catch (err) {
    loginError.textContent = "Erro ao conectar ao servidor";
  }
};

logoutBtn.onclick = () => {
  token = "";
  role = "";
  appPanel.classList.add("hidden");
  loginPanel.classList.remove("hidden");
};

// ----- MOSTRAR PAINEL POR ROLE -----
function mostrarPainel(role) {
  document
    .querySelectorAll(".user-panel")
    .forEach((el) => el.classList.add("hidden"));
  if (role === "atendente")
    document.getElementById("atendente-panel").classList.remove("hidden");
  if (role === "cozinha")
    document.getElementById("cozinha-panel").classList.remove("hidden");
  if (role === "despachante")
    document.getElementById("despachante-panel").classList.remove("hidden");
  if (role === "admin")
    document.getElementById("admin-panel").classList.remove("hidden");
}

// ----- ATENDENTE: CRIAR PEDIDO -----
const criarPedidoBtn = document.getElementById("criar-pedido-btn");
const combosInput = document.getElementById("combos");
const refrigerantesContainer = document.getElementById(
  "refrigerantes-container"
);

combosInput.oninput = () => {
  refrigerantesContainer.innerHTML = "";
  const qtd = parseInt(combosInput.value) || 0;
  for (let i = 0; i < qtd; i++) {
    const select = document.createElement("select");
    select.innerHTML = `
      <option value="Coca-Cola">Coca-Cola</option>
      <option value="Coca-Zero">Coca-Zero</option>
      <option value="Guaraná">Guaraná</option>
    `;
    select.dataset.index = i;
    refrigerantesContainer.appendChild(select);
  }
};

criarPedidoBtn.onclick = async () => {
  const cliente = document.getElementById("cliente").value;
  const combos = parseInt(document.getElementById("combos").value);
  const observacoes = document.getElementById("observacoes").value;
  const selects = [...refrigerantesContainer.querySelectorAll("select")];
  const refrigerantes = selects.map((s) => s.value);

  try {
    const res = await fetch("https://hamburgueria-mezu.onrender.com/pedidos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ cliente, combos, refrigerantes, observacoes }),
    });
    const data = await res.json();
    if (res.ok) {
      alert("Pedido criado com sucesso!");
      carregarPedidos();
    } else {
      alert(data.error);
    }
  } catch (err) {
    alert("Erro ao criar pedido");
  }
};

// ----- CARREGAR PEDIDOS (TEMPO REAL) -----
async function carregarPedidos() {
  try {
    const res = await fetch("https://hamburgueria-mezu.onrender.com/pedidos", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const pedidos = await res.json();
    atualizarUI(pedidos);
  } catch (err) {
    console.error(err);
  }
}

function atualizarUI(pedidos) {
  // Atendente
  if (role === "atendente") {
    const lista = document.getElementById("pedidos-list");
    lista.innerHTML = "";
    pedidos.forEach((p) => {
      const div = document.createElement("div");
      div.className = "pedido-card";
      div.innerHTML = `
        <strong>Pedido #${p.numero}</strong> - ${p.cliente}<br>
        Status: ${p.status}<br>
        Combos: ${p.order_items.map((i) => i.refrigerante).join(", ")}
      `;
      lista.appendChild(div);
    });
  }

  // Cozinha
  if (role === "cozinha") {
    const recebidos = document.getElementById("pedidos-recebidos");
    const andamento = document.getElementById("pedidos-andamento");
    recebidos.innerHTML = "";
    andamento.innerHTML = "";
    pedidos.forEach((p) => {
      const div = document.createElement("div");
      div.className = "pedido-card";
      div.innerHTML = `<strong>#${p.numero}</strong> - ${p.cliente}<br>Status: ${p.status}<br>Combos: ${p.order_items.map((i) => i.refrigerante).join(", ")}`;
      if (p.status === "pendente") {
        const btn = document.createElement("button");
        btn.textContent = "Em Preparo";
        btn.onclick = () => atualizarStatus(p.numero, "em preparo");
        div.appendChild(btn);
        recebidos.appendChild(div);
      }
      if (p.status === "em preparo") {
        const btn = document.createElement("button");
        btn.textContent = "Concluído";
        btn.onclick = () => atualizarStatus(p.numero, "concluido");
        div.appendChild(btn);
        andamento.appendChild(div);
      }
    });
  }

  // Despachante
  if (role === "despachante") {
    const prontos = document.getElementById("pedidos-prontos");
    prontos.innerHTML = "";
    pedidos.forEach((p) => {
      if (p.status === "concluido") {
        const div = document.createElement("div");
        div.className = "pedido-card";
        div.innerHTML = `<strong>#${p.numero}</strong> - ${p.cliente}<br>Status: ${p.status}<br>Combos: ${p.order_items.map((i) => i.refrigerante).join(", ")}`;
        const btn = document.createElement("button");
        btn.textContent = "Entregue";
        btn.onclick = () => atualizarStatus(p.numero, "entregue");
        div.appendChild(btn);
        prontos.appendChild(div);
      }
    });
  }

  // Admin
  if (role === "admin") {
    const adminDiv = document.getElementById("admin-pedidos");
    adminDiv.innerHTML = "";
    pedidos.forEach((p) => {
      const div = document.createElement("div");
      div.className = "pedido-card";
      div.innerHTML = `<strong>#${p.numero}</strong> - ${p.cliente}<br>Status: ${p.status}<br>Combos: ${p.order_items.map((i) => i.refrigerante).join(", ")}`;
      adminDiv.appendChild(div);
    });
  }
}

// ----- ATUALIZAR STATUS -----
async function atualizarStatus(numero, status) {
  try {
    const res = await fetch(
      `https://hamburgueria-mezu.onrender.com/pedidos/${numero}`,
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
    if (res.ok) carregarPedidos();
    else alert(data.error);
  } catch (err) {
    alert("Erro ao atualizar status");
  }
}

// ----- SOCKET.IO -----
socket.on("novoPedido", () => carregarPedidos());
socket.on("atualizarPedido", () => carregarPedidos());
