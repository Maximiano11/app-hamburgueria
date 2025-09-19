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
    document.getElementById("role-name").innerText = role;
    document.getElementById("login-panel").classList.add("hidden");
    document.getElementById("app-panel").classList.remove("hidden");
    mostrarPainel(role);
    carregarPedidos();
  } else {
    document.getElementById("login-error").innerText = data.error;
  }
});

// Logout
document.getElementById("logoutBtn").addEventListener("click", () => {
  token = null;
  role = null;
  location.reload();
});

// Mostrar painel específico
function mostrarPainel(role) {
  if (role === "atendente")
    document.getElementById("atendente-panel").classList.remove("hidden");
  if (role === "cozinha")
    document.getElementById("cozinha-panel").classList.remove("hidden");
  if (role === "despachante")
    document.getElementById("despachante-panel").classList.remove("hidden");
}

// Adicionar combos dinamicamente
document.getElementById("numCombos").addEventListener("input", () => {
  const container = document.getElementById("combos-container");
  container.innerHTML = "";
  const num = parseInt(document.getElementById("numCombos").value);
  for (let i = 0; i < num; i++) {
    const div = document.createElement("div");
    div.classList.add("combo-item");
    div.innerHTML = `
      <input type="text" placeholder="Combo ${i + 1}">
      <select>
        <option value="Coca-Cola">Coca-Cola</option>
        <option value="Coca-Zero">Coca-Zero</option>
        <option value="Guaraná">Guaraná</option>
      </select>
    `;
    container.appendChild(div);
  }
});

// Adicionar pedido
document.getElementById("addPedidoBtn").addEventListener("click", async () => {
  const cliente = document.getElementById("cliente").value;
  const observacoes = document.getElementById("observacoes").value;
  const combosElements = document.querySelectorAll(".combo-item");
  const combos = [];
  const refrigerantes = [];
  combosElements.forEach((el) => {
    combos.push(el.querySelector("input").value);
    refrigerantes.push(el.querySelector("select").value);
  });

  const res = await fetch("/pedidos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ cliente, combos, refrigerantes, observacoes }),
  });

  const data = await res.json();
  if (res.ok) {
    document.getElementById("pedido-msg").innerText = data.message;
    carregarPedidos();
  } else {
    document.getElementById("pedido-msg").innerText = data.error;
  }
});

// Carregar pedidos
async function carregarPedidos() {
  if (!token) return;
  const res = await fetch("/pedidos", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const pedidos = await res.json();
  // Limpa painéis
  document.getElementById("pedidos-cozinha").innerHTML = "";
  document.getElementById("pedidos-despachante").innerHTML = "";

  pedidos.forEach((p) => {
    const div = document.createElement("div");
    div.classList.add("pedido-item");
    div.innerHTML = `
      <strong>#${p.numero}</strong> - ${p.cliente} <br>
      Combos: ${p.combos.map((c, i) => `${c} (${p.refrigerantes[i]})`).join(", ")} <br>
      Status: ${p.status} <br>
      Observações: ${p.observacoes || "-"} <br>
    `;
    if (role === "cozinha" && p.status === "pendente") {
      const btn = document.createElement("button");
      btn.innerText = "Em Preparo";
      btn.addEventListener("click", async () => {
        await fetch(`/pedidos/${p.numero}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: "em preparo" }),
        });
        carregarPedidos();
      });
      div.appendChild(btn);
    }
    if (role === "despachante" && p.status === "em preparo") {
      const btn = document.createElement("button");
      btn.innerText = "Entregue";
      btn.addEventListener("click", async () => {
        await fetch(`/pedidos/${p.numero}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: "entregue" }),
        });
        carregarPedidos();
      });
      div.appendChild(btn);
    }

    if (role === "cozinha")
      document.getElementById("pedidos-cozinha").appendChild(div);
    if (role === "despachante")
      document.getElementById("pedidos-despachante").appendChild(div);
  });
}
