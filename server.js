// server.js
const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const http = require("http");
const { Server } = require("socket.io");

// Configurações
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3000;
const SECRET_KEY = "hamburguer-cec"; // coloque em variável de ambiente em produção

// Supabase
const SUPABASE_URL = "https://krybnbkjuwhpjhykfjeb.supabase.co";
const SUPABASE_KEY = "maximianuss445229980"; // use anon/public key para client ou service_role para server
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Middlewares
app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public"));

// ----- AUTENTICAÇÃO -----
const users = [
  { username: "atendente1", password: "123", role: "atendente" },
  { username: "cozinha1", password: "123", role: "cozinha" },
  { username: "despachante1", password: "123", role: "despachante" },
  { username: "admin", password: "admin123", role: "admin" },
];

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(
    (u) => u.username === username && u.password === password
  );
  if (!user)
    return res.status(401).json({ error: "Usuário ou senha inválidos" });

  const token = jwt.sign(
    { username: user.username, role: user.role },
    SECRET_KEY,
    { expiresIn: "4h" }
  );
  res.json({ token, role: user.role });
});

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

// ----- PEDIDOS -----
async function criarPedidoDB(pedido) {
  const { data, error } = await supabase.from("pedidos").insert([pedido]);
  if (error) throw error;
  return data[0];
}

async function atualizarPedidoDB(numero, status) {
  const { data, error } = await supabase
    .from("pedidos")
    .update({ status, atualizado_em: new Date() })
    .eq("numero", numero);
  if (error) throw error;
  return data[0];
}

async function listarPedidosDB() {
  const { data, error } = await supabase
    .from("pedidos")
    .select("*")
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data;
}

// ----- ROTAS -----

// Criar pedido (apenas atendente)
app.post("/pedidos", autenticar, async (req, res) => {
  if (!["atendente", "admin"].includes(req.user.role))
    return res.status(403).json({ error: "Permissão negada" });

  try {
    const { cliente, combos } = req.body;
    // combos = [{ nomeCombo, refrigerante }] array
    const pedido = {
      cliente,
      combos: JSON.stringify(combos),
      status: "pendente",
      criado_em: new Date(),
    };
    const novoPedido = await criarPedidoDB(pedido);
    io.emit("novo-pedido", novoPedido);
    res.json({ message: "Pedido criado com sucesso!", pedido: novoPedido });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar pedido" });
  }
});

// Atualizar status (cozinha ou despachante)
app.put("/pedidos/:numero", autenticar, async (req, res) => {
  const { numero } = req.params;
  const { status } = req.body;

  // Cozinha só pode colocar "em preparo" ou "concluido" no painel dela
  if (
    req.user.role === "cozinha" &&
    !["em preparo", "concluido"].includes(status)
  )
    return res.status(403).json({ error: "Permissão negada" });

  // Despachante só pode colocar "entregue"
  if (req.user.role === "despachante" && status !== "entregue")
    return res.status(403).json({ error: "Permissão negada" });

  try {
    const pedidoAtualizado = await atualizarPedidoDB(numero, status);
    io.emit("atualizacao-pedido", pedidoAtualizado);
    res.json({ message: "Status atualizado!", pedido: pedidoAtualizado });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar status" });
  }
});

// Listar pedidos (todos)
app.get("/pedidos", autenticar, async (req, res) => {
  try {
    const pedidos = await listarPedidosDB();
    res.json(pedidos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao listar pedidos" });
  }
});

// ----- SOCKET.IO -----
io.on("connection", (socket) => {
  console.log("Novo cliente conectado:", socket.id);
});

// ----- INICIAR SERVIDOR -----
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
