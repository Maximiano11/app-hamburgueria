let token = "";
let role = "";

function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.token) {
        token = data.token;
        role = data.role;
        document.querySelector(".login-panel").style.display = "none";
        document.querySelector(".user-panel").style.display = "block";
        carregarPedidos();
      } else {
        document.getElementById("login-msg").textContent = data.error;
      }
    });
}

function switchPanel(panelName) {
  document
    .querySelectorAll(".panel")
    .forEach((p) => (p.style.display = "none"));
  document.getElementById(panelName).style.display = "block";
}

function criarPedido() {
  const cliente = document.getElementById("cliente").value;
  const combos = document.getElementById("combos").value;
  const refrigerante = document.getElementById("refrigerante").value;
  const observacoes = document.getElementById("observacoes").value;

  fetch("/pedidos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ cliente, combos, refrigerante, observacoes }),
  })
    .then((res) => res.json())
    .then((data) => {
      alert(data.message);
      carregarPedidos();
    });
}

function carregarPedidos() {
  fetch("/pedidos", {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => res.json())
    .then((data) => {
      const pendentes = data.filter((p) => p.status === "pendente");
      const preparo = data.filter((p) => p.status === "preparo");
      const concluidos = data.filter((p) => p.status === "concluido");

      document.getElementById("pedidosCozinha").innerHTML = preparo
        .concat(pendentes)
        .map(
          (p) => `
            <div>
                <strong>#${p.numero} - ${p.cliente}</strong>
                <p>Status: ${p.status}</p>
                ${
                  role === "cozinha" && p.status !== "concluido"
                    ? `<button onclick="atualizarStatus(${p.numero}, 'concluido')">Concluir</button>`
                    : ""
                }
            </div>
        `
        )
        .join("");

      document.getElementById("pedidosDespachante").innerHTML = concluidos
        .map(
          (p) => `
            <div>
                <strong>#${p.numero} - ${p.cliente}</strong>
                <p>Status: ${p.status}</p>
            </div>
        `
        )
        .join("");
    });
}

function atualizarStatus(numero, status) {
  fetch(`/pedidos/${numero}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  })
    .then((res) => res.json())
    .then((data) => {
      alert(data.message);
      carregarPedidos();
    });
}
