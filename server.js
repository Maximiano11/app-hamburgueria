require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET;

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public"));

// ----- SOCKET.IO -----
function atualizarPedidosRealtime() {
  io.emit("pedidoAtualizado");
}

io.on("connection", (socket) => {
  console.log("Cliente conectado: ", socket.id);
});

// ----- JWT Middleware -----
function autenticar(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader)
    return res.status(401).json({ error: "Token não fornecido" });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: "Token inválido" });
    req.user = user;
    next();
  });
}

// ----- ROTAS -----

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const { data: users } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .limit(1);

  if (!users || users.length === 0)
    return res.status(401).json({ error: "Usuário ou senha inválidos" });

  const user = users[0];
  const senhaValida = bcrypt.compareSync(password, user.password);
  if (!senhaValida)
    return res.status(401).json({ error: "Usuário ou senha inválidos" });

  const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, {
    expiresIn: "4h",
  });
  res.json({ token, role: user.role });
});

// Criar pedido (Atendente ou Admin)
app.post("/pedidos", autenticar, async (req, res) => {
  if (!["atendente", "admin"].includes(req.user.role))
    return res.status(403).json({ error: "Permissão negada" });

  const { cliente, combos, refrigerantes, observacoes } = req.body;
  try {
    // Cria pedido
    const { data: novoPedido } = await supabase
      .from("orders")
      .insert([{ numero: Date.now(), cliente, status: "pendente" }])
      .select()
      .single();

    // Cria itens do pedido
    for (let i = 0; i < combos; i++) {
      await supabase
        .from("order_items")
        .insert([
          {
            order_id: novoPedido.id,
            item_index: i + 1,
            refrigerante: refrigerantes[i],
          },
        ]);
    }

    atualizarPedidosRealtime();
    res.json({ message: "Pedido criado com sucesso!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar pedido" });
  }
});

// Atualizar status do pedido (Cozinha, Despachante ou Admin)
app.put("/pedidos/:id", autenticar, async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;
  const rolesPermitidos = {
    cozinha: ["em preparo", "concluido"],
    despachante: ["entregue"],
    admin: ["pendente", "em preparo", "concluido", "entregue"],
  };

  if (
    !rolesPermitidos[req.user.role]?.includes(status) &&
    req.user.role !== "admin"
  )
    return res.status(403).json({ error: "Permissão negada" });

  try {
    await supabase.from("orders").update({ status }).eq("id", id);
    atualizarPedidosRealtime();
    res.json({ message: "Status atualizado!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar status" });
  }
});

// Listar pedidos
app.get("/pedidos", autenticar, async (req, res) => {
  try {
    const { data: pedidos } = await supabase
      .from("orders")
      .select(
        `
      *,
      order_items(*)
    `
      )
      .order("criado_em", { ascending: true });
    res.json(pedidos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar pedidos" });
  }
});

// Iniciar servidor
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
