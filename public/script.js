document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  // DOM elements
  const loginDiv = document.getElementById("loginDiv");
  const appDiv = document.getElementById("appDiv");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const roleTitle = document.getElementById("roleTitle");

  const atendentePanel = document.getElementById("atendentePanel");
  const clienteInput = document.getElementById("cliente");
  const quantidadeInput = document.getElementById("quantidade");
  const refrigerantesContainer = document.getElementById(
    "refrigerantesContainer"
  );
  const observacoesInput = document.getElementById("observacoes");
  const criarPedidoBtn = document.getElementById("criarPedidoBtn");

  const pedidosRecebidos = document.getElementById("pedidosRecebidos");
  const pedidosAndamento = document.getElementById("pedidosAndamento");
  const pedidosDespacho = document.getElementById("pedidosDespacho");

  let token = null;
  let role = null;

  // Funções
  function gerarRefrigerantesInputs() {
    refrigerantesContainer.innerHTML = "";
    const quantidade = parseInt(quantidadeInput.value);
    for (let i = 0; i < quantidade; i++) {
      const select = document.createElement("select");
      select.innerHTML = `
        <option value="Coca-Cola">Coca-Cola</option>
        <option value="Coca-Zero">Coca-Zero</option>
        <option value="Guaraná">Guaraná</option>
      `;
      refrigerantesContainer.appendChild(select);
    }
  }

  quantidadeInput.addEventListener("change", gerarRefrigerantesInputs);
  gerarRefrigerantesInputs();

  loginBtn.onclick = async () => {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: usernameInput.value,
        password: passwordInput.value,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      token = data.token;
      role = data.role;
      loginDiv.classList.add("hidden");
      appDiv.classList.remove("hidden");
      roleTitle.textContent = `Logado como ${role}`;
      mostrarPainel(role);
      carregarPedidos();
    } else {
      alert(data.error);
    }
  };

  logoutBtn.onclick = () => {
    token = null;
    role = null;
    loginDiv.classList.remove("hidden");
    appDiv.classList.add("hidden");
  };

  function mostrarPainel(role) {
    atendentePanel.classList.add("hidden");
    cozinhaPanel.classList.add("hidden");
    despachantePanel.classList.add("hidden");

    if (role === "atendente") atendentePanel.classList.remove("hidden");
    if (role === "cozinha") cozinhaPanel.classList.remove("hidden");
    if (role === "despachante") despachantePanel.classList.remove("hidden");
    if (role === "admin") {
      atendentePanel.classList.remove("hidden");
      cozinhaPanel.classList.remove("hidden");
      despachantePanel.classList.remove("hidden");
    }
  }

  criarPedidoBtn.onclick = async () => {
    const itens = Array.from(
      refrigerantesContainer.querySelectorAll("select")
    ).map((s) => s.value);
    const res = await fetch("/pedidos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        cliente: clienteInput.value,
        itens,
        observacoes: observacoesInput.value,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      clienteInput.value = "";
      observacoesInput.value = "";
      quantidadeInput.value = 1;
      gerarRefrigerantesInputs();
    } else {
      alert(data.error);
    }
  };

  async function carregarPedidos() {
    if (!token) return;
    const res = await fetch("/pedidos", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const pedidos = await res.json();
    atualizarUI(pedidos);
  }

  function atualizarUI(pedidos) {
    pedidosRecebidos.innerHTML = "";
    pedidosAndamento.innerHTML = "";
    pedidosDespacho.innerHTML = "";

    pedidos.forEach((p) => {
      const div = document.createElement("div");
      div.classList.add("pedido");
      div.innerHTML = `
        <strong>#${p.id}</strong> - ${p.cliente} - ${p.status}
      `;

      if (role === "cozinha" && p.status === "pendente") {
        const btn = document.createElement("button");
        btn.textContent = "Em preparo";
        btn.onclick = () => atualizarStatus(p.id, "em preparo");
        div.appendChild(btn);
        pedidosRecebidos.appendChild(div);
      } else if (role === "cozinha" && p.status === "em preparo") {
        const btn = document.createElement("button");
        btn.textContent = "Concluído";
        btn.onclick = () => atualizarStatus(p.id, "concluido");
        div.appendChild(btn);
        pedidosAndamento.appendChild(div);
      } else if (role === "despachante" && p.status === "concluido") {
        const btn = document.createElement("button");
        btn.textContent = "Entregue";
        btn.onclick = () => atualizarStatus(p.id, "entregue");
        div.appendChild(btn);
        pedidosDespacho.appendChild(div);
      } else if (role === "atendente" || role === "admin") {
        if (p.status === "pendente") pedidosRecebidos.appendChild(div);
        if (p.status === "em preparo") pedidosAndamento.appendChild(div);
        if (p.status === "concluido") pedidosDespacho.appendChild(div);
      }
    });
  }

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
    if (!res.ok) alert(data.error);
  }

  socket.on("updatePedidos", (pedidos) => {
    atualizarUI(pedidos);
  });
});
