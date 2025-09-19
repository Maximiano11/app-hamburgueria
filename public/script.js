const socket = io("https://hamburgueria-mezu.onrender.com");

// Login
const loginPanel = document.getElementById("loginPanel");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");

const welcomePanel = document.getElementById("welcomePanel");
const userRoleSpan = document.getElementById("userRole");
const logoutBtn = document.getElementById("logoutBtn");

let token = null;
let role = null;

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
    if (res.status !== 200) throw new Error(data.error);
    token = data.token;
    role = data.role;
    userRoleSpan.textContent = `${username} (${role})`;
    loginPanel.classList.add("hidden");
    welcomePanel.classList.remove("hidden");

    showPanel(role);
    carregarPedidos();
  } catch (err) {
    loginError.textContent = err.message;
  }
};

logoutBtn.onclick = () => {
  token = null;
  role = null;
  location.reload();
};

// Mostrar painel correto
function showPanel(role) {
  const panels = {
    atendente: "atendentePanel",
    cozinha: "cozinhaPanel",
    despachante: "despachantePanel",
    admin: "atendentePanel", // admin pode ver tudo, por enquanto atendente
  };
  Object.values(panels).forEach((p) =>
    document.getElementById(p).classList.add("hidden")
  );
  if (panels[role])
    document.getElementById(panels[role]).classList.remove("hidden");
}

// Atendente - refrigerantes dinâmicos
const combosInput = document.getElementById("combos");
const refrigerantesContainer = document.getElementById(
  "refrigerantesContainer"
);

combosInput.oninput = () => {
  refrigerantesContainer.innerHTML = "";
  const qtd = parseInt(combosInput.value) || 0;
  for (let i = 0; i < qtd; i++) {
    const sel = document.createElement("select");
    sel.innerHTML = `
      <option value="Coca-Cola">Coca-Cola</option>
      <option value="Coca-Zero">Coca-Zero</option>
      <option value="Guaraná">Guaraná</option>
    `;
    sel.dataset.index = i;
    refrigerantesContainer.appendChild(sel);
  }
};

// Criar pedido
const criarPedidoBtn = document.getElementById("criarPedidoBtn");
criarPedidoBtn.onclick = async () => {
  const cliente = document.getElementById("cliente").value;
  const combos = parseInt(document.getElementById("combos").value);
  const observacoes = document.getElementById("observacoes").value;

  const refrigerantes = Array.from(
    refrigerantesContainer.querySelectorAll("select")
  ).map((s) => s.value);

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
    if (res.status !== 200) throw new Error(data.error);
    alert("Pedido criado!");
    carregarPedidos();
  } catch (err) {
    alert("Erro ao criar pedido: " + err.message);
  }
};

// Carregar pedidos em tempo real
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

// Atualizar UI (simplificado, você pode detalhar para cada função)
function atualizarUI(pedidos) {
  const list = document.getElementById("pedidosList");
  if (!list) return;
  list.innerHTML = "";
  pedidos.forEach((p) => {
    const div = document.createElement("div");
    div.className = "pedidoCard";
    div.innerHTML = `
      <strong>Pedido #${p.id}</strong> - ${p.cliente}<br>
      Status: ${p.status}<br>
      Observações: ${p.observacoes || "-"}<br>
      Itens: ${p.itens ? p.itens.map((i) => `<img src="${i.refrigerante}.png"> ${i.refrigerante}`).join(", ") : ""}
    `;
    list.appendChild(div);
  });
}

// Socket.IO - receber atualização em tempo real
socket.on("pedidoAtualizado", (data) => {
  carregarPedidos();
});
