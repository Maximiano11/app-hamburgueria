let token = null;
let role = null;

// Login
document.getElementById("loginBtn").addEventListener("click", async () => {
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
    document.getElementById("loginPanel").classList.add("hidden");
    document.getElementById("mainPanel").classList.remove("hidden");
    document.getElementById("userRole").innerText = role;
    initPanels();
    fetchPedidos();
  } else {
    document.getElementById("loginError").innerText = data.error;
  }
});

// Logout
document.getElementById("logoutBtn").addEventListener("click", () => {
  token = null;
  role = null;
  document.getElementById("mainPanel").classList.add("hidden");
  document.getElementById("loginPanel").classList.remove("hidden");
});

// Inicializa painéis conforme role
function initPanels() {
  if (role === "atendente")
    document.getElementById("atendentePanel").classList.remove("hidden");
  if (role === "cozinha")
    document.getElementById("cozinhaPanel").classList.remove("hidden");
  if (role === "despachante")
    document.getElementById("despachantePanel").classList.remove("hidden");

  // Atendente: atualiza combos
  const numCombosInput = document.getElementById("numCombos");
  numCombosInput.addEventListener("change", renderRefrigerantesInputs);
  renderRefrigerantesInputs();
}

// Renderiza inputs de refrigerantes conforme número de combos
function renderRefrigerantesInputs() {
  const container = document.getElementById("refrigerantesContainer");
  const num = parseInt(document.getElementById("numCombos").value) || 1;
  container.innerHTML = "";
  for (let i = 0; i < num; i++) {
    const select = document.createElement("select");
    select.classList.add("refrigerante");
    ["Coca-Cola", "Coca-Zero", "Guarana"].forEach((r) => {
      const option = document.createElement("option");
      option.value = r;
      option.innerText = r;
      select.appendChild(option);
    });
    container.appendChild(select);
  }
}

// Adicionar pedido
document.getElementById("addPedidoBtn")?.addEventListener("click", async () => {
  const cliente = document.getElementById("cliente").value;
  const combos = Array.from(
    { length: parseInt(document.getElementById("numCombos").value) },
    (_, i) => `Combo ${i + 1}`
  );
  const refrigerantes = Array.from(
    document.getElementsByClassName("refrigerante")
  ).map((sel) => sel.value);
  const observacoes = document.getElementById("observacoes").value;

  const res = await fetch("/pedidos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ cliente, combos, refrigerantes, observacoes }),
  });
  const data = await res.json();
  if (res.ok) fetchPedidos();
  else alert(data.error);
});

// Buscar pedidos e atualizar painéis
async function fetchPedidos() {
  const res = await fetch("/pedidos", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const pedidos = await res.json();

  // Cozinha
  const cozinhaDiv = document.getElementById("pedidosCozinha");
  if (cozinhaDiv) {
    cozinhaDiv.innerHTML = "";
    pedidos
      .filter((p) => p.status === "pendente")
      .forEach((p) => {
        const div = document.createElement("div");
        div.classList.add("pedido");
        div.innerHTML = `<strong>#${p.id}</strong> Cliente: ${p.cliente} <br> Status: ${p.status} <br>
        <button onclick="atualizarStatus(${p.id}, 'em preparo')">Marcar Em Preparo</button>`;
        cozinhaDiv.appendChild(div);
      });
  }

  // Despachante
  const despDiv = document.getElementById("pedidosDespachante");
  if (despDiv) {
    despDiv.innerHTML = "";
    pedidos
      .filter((p) => p.status === "em preparo")
      .forEach((p) => {
        const div = document.createElement("div");
        div.classList.add("pedido");
        div.innerHTML = `<strong>#${p.id}</strong> Cliente: ${p.cliente} <br> Status: ${p.status} <br>
        <button onclick="atualizarStatus(${p.id}, 'entregue')">Marcar Entregue</button>`;
        despDiv.appendChild(div);
      });
  }
}

// Atualizar status
async function atualizarStatus(id, status) {
  const res = await fetch(`/pedidos/${id}`, {
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
}

// Atualização em tempo real a cada 3 segundos (polling simples)
setInterval(() => {
  if (token) fetchPedidos();
}, 3000);
