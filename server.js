const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public")); // serve arquivos front-end

// Usuários simples, todos podem criar pedidos
const users = [
  { username: "atendente1", password: "123" },
  { username: "cozinha1", password: "123" },
  { username: "despachante1", password: "123" },
];

// Pedidos em memória
let pedidos = [];
let proximoNumero = 1;

// ----- ROTAS -----

// Login simples
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(
    (u) => u.username === username && u.password === password
  );
  if (!user)
    return res.status(401).json({ error: "Usuário ou senha inválidos" });
  res.json({ username: user.username });
});

// Criar pedido
app.post("/pedidos", (req, res) => {
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

  // Envia para todos os clientes conectados em tempo real
  io.emit("novo-pedido", pedido);

  res.json({ message: "Pedido criado com sucesso!", pedido });
});

// Listar pedidos
app.get("/pedidos", (req, res) => {
  res.json(pedidos);
});

// ----- SOCKET.IO -----
io.on("connection", (socket) => {
  console.log("Novo usuário conectado");

  // Envia todos os pedidos atuais para o usuário recém-conectado
  socket.emit("todos-pedidos", pedidos);

  socket.on("disconnect", () => {
    console.log("Usuário desconectado");
  });
});

// Inicia servidor
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
