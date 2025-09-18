const express = require("express");
const http = require("http");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const PORT = process.env.PORT || 3000;
const SECRET_KEY = "hamburguer-cec"; // trocar por env var em produção

app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public")); // pasta com index.html, style.css e script.js

// Usuários e roles
const users = [
  { username: "atendente1", password: "123", role: "atendente" },
  { username: "cozinha1", password: "123", role: "cozinha" },
  { username: "despachante1", password: "123", role: "despachante" },
];

// Pedidos em memória
let pedidos = [];
let proximoNumero = 1;

// ----- ROTAS -----
// Login
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

// Middleware de autenticação
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

// Criar pedido (somente atendente)
app.post("/pedidos", autenticar, (req, res) => {
  if (req.user.role !== "atendente")
    return res.status(403).json({ error: "Permissão negada" });

  const { cliente, combos, refrigerante, observacoes } = req.body;
  const pedido = {
    numero: proximoNumero++,
    cliente,
    combos,
    refrigerante,
    observacoes,
    status: "pendente",
    criadoEm: new Date().toLocaleString(),
  };
  pedidos.push(pedido);
  io.emit("novoPedido", pedido); // envia para todos os clientes em tempo real
  res.json({ message: "Pedido criado com sucesso!", pedido });
});

// Atualizar status (somente cozinha e despachante)
app.put("/pedidos/:numero", autenticar, (req, res) => {
  const { numero } = req.params;
  const { status } = req.body;
  const pedido = pedidos.find((p) => p.numero == numero);
  if (!pedido) return res.status(404).json({ error: "Pedido não encontrado" });

  if (req.user.role === "cozinha") {
    if (status !== "preparo" && status !== "concluido")
      return res.status(403).json({ error: "Permissão negada" });
  } else if (req.user.role === "despachante") {
    if (status !== "entregue")
      return res.status(403).json({ error: "Permissão negada" });
  } else {
    return res.status(403).json({ error: "Permissão negada" });
  }

  pedido.status = status;
  pedido.atualizadoEm = new Date().toLocaleString();
  io.emit("atualizarPedido", pedido); // atualiza todos os clientes
  res.json({ message: "Status atualizado!", pedido });
});

// Listar pedidos (todos)
app.get("/pedidos", autenticar, (req, res) => {
  res.json(pedidos);
});

// Socket.IO conexão
io.on("connection", (socket) => {
  console.log("Usuário conectado:", socket.id);
});

// Iniciar servidor
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
