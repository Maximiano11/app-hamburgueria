const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const mainDiv = document.getElementById("mainDiv");
const loginDiv = document.getElementById("loginDiv");

let token, role;
const socket = io("https://hamburgueria-mezu.onrender.com");

// Login
loginBtn.onclick = async () => {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (data.error) return alert(data.error);

    token = data.token;
    role = data.role;
    loginDiv.style.display = "none";
    mainDiv.style.display = "block";

    setupUI();
    carregarPedidos();
  } catch (e) {
    console.error(e);
    alert("Erro ao logar");
  }
};

logoutBtn.onclick = () => {
  token = null;
  role = null;
  loginDiv.style.display = "block";
  mainDiv.style.display = "none";
};

// Configura painel conforme role
function setupUI() {
  if (["atendente", "admin"].includes(role))
    document.getElementById("atendentePanel").style.display = "block";
  if (["cozinha", "admin"].includes(role))
    document.getElementById("cozinhaPanel").style.display = "block";
  if (["despachante", "admin"].includes(role))
    document.getElementById("despachantePanel").style.display = "block";
}

// Criar pedido
document.getElementById("criarPedidoBtn").onclick = async () => {
  const cliente = document.getElementById("cliente").value;
  const combos = parseInt(document.getElementById("combos").value);
  const observacoes = document.getElementById("observacoes").value;

  const refrigerantes = [];
  for (let i = 0; i < combos; i++) {
    refrigerantes.push(document.getElementById(`refrigerante${i}`).value);
  }

  try {
    const res = await fetch("/pedidos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ cliente, combos, refrigerantes, observacoes }),
    });
    const data = await res.json();
    if (data.error) return alert(data.error);
    alert(data.message);
  } catch (e) {
    console.error(e);
    alert("Erro ao criar pedido");
  }
};

// Atualizar pedidos em tempo real
socket.on("pedidoAtualizado", () => carregarPedidos());

async function carregarPedidos() {
  if (!token) return;
  try {
    const res = await fetch("/pedidos", {
      headers: { Authorization: "Bearer " + token },
    });
    const pedidos = await res.json();
    atualizarUI(pedidos);
  } catch (e) {
    console.error(e);
  }
}

function atualizarUI(pedidos) {
  if (!Array.isArray(pedidos)) return;
  // Atualiza os painéis
  document.getElementById("pedidosRecebidos").innerHTML = "";
  document.getElementById("pedidosEmPreparo").innerHTML = "";
  document.getElementById("pedidosProntos").innerHTML = "";

  pedidos.forEach((p) => {
    const div = document.createElement("div");
    div.className = "pedido";
    div.innerHTML = `<b>#${p.numero}</b> ${p.cliente} <br> Status: ${p.status}`;

    if (["cozinha", "admin"].includes(role)) {
      if (p.status === "pendente") {
        document.getElementById("pedidosRecebidos").appendChild(div);
        const btn = document.createElement("button");
        btn.innerText = "Em preparo";
        btn.onclick = () => atualizarStatus(p.id, "em preparo");
        div.appendChild(btn);
      } else if (p.status === "em preparo") {
        document.getElementById("pedidosEmPreparo").appendChild(div);
        const btn = document.createElement("button");
        btn.innerText = "Concluido";
        btn.onclick = () => atualizarStatus(p.id, "concluido");
        div.appendChild(btn);
      }
    }

    if (["despachante", "admin"].includes(role) && p.status === "concluido") {
      document.getElementById("pedidosProntos").appendChild(div);
      const btn = document.createElement("button");
      btn.innerText = "Entregue";
      btn.onclick = () => atualizarStatus(p.id, "entregue");
      div.appendChild(btn);
    }
  });
}

async function atualizarStatus(id, status) {
  try {
    await fetch("/pedidos/" + id, {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });
  } catch (e) {
    console.error(e);
  }
}

// Gerar selects de refrigerante
document.getElementById("combos").onchange = () => {
  const n = parseInt(document.getElementById("combos").value);
  const div = document.getElementById("refrigerantesDiv");
  div.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const select = document.createElement("select");
    select.id = `refrigerante${i}`;
    select.innerHTML = `<option value="Coca-Cola">Coca-Cola</option>
                      <option value="Coca-Zero">Coca-Zero</option>
                      <option value="Guaraná">Guaraná</option>`;
    div.appendChild(select);
  }
};
