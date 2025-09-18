const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = "hamburguer-cec";

app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public"));

// Usuários e roles
const users = [
  { username: "atendente1", password: "123", role: "atendente" },
  { username: "cozinha1", password: "123", role: "cozinha" },
  { username: "despachante1", password: "123", role: "despachante" },
];

// Pedidos em memória
let pedidos = [];
let proximoNumero = 1;

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

// HTTP + Socket.IO
const httpServer = http.createServer(app);
const io = new Server(httpServer);

io.on("connection", (socket) => {
  console.log("Novo usuário conectado");
  socket.emit("pedidos-atualizados", pedidos);

  socket.on("criar-pedido", (pedido) => {
    pedido.numero = proximoNumero++;
    pedido.status = "pendente";
    pedido.criadoEm = new Date().toLocaleString();
    pedidos.push(pedido);
    io.emit("pedidos-atualizados", pedidos);
  });

  socket.on("atualizar-status", ({ numero, status }) => {
    const p = pedidos.find((p) => p.numero == numero);
    if (p) {
      p.status = status;
      p.atualizadoEm = new Date().toLocaleString();
      io.emit("pedidos-atualizados", pedidos);
    }
  });

  socket.on("disconnect", () => console.log("Usuário desconectado"));
});

// Iniciar servidor
httpServer.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
