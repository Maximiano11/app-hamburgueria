const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = "hamburguer-cec"; // usar variável de ambiente em produção

app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public")); // serve arquivos front-end

// Usuários e roles
const users = [
  { username: "atendente1", password: "123", role: "atendente" },
  { username: "cozinha1", password: "123", role: "cozinha" },
  { username: "despachante1", password: "123", role: "despachante" },
];

// Pedidos em memória (pode ser trocado por DB leve como SQLite)
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
  res.json({ message: "Pedido criado com sucesso!", pedido });
});

// Atualizar status do pedido (somente cozinha)
app.put("/pedidos/:numero", autenticar, (req, res) => {
  if (req.user.role !== "cozinha")
    return res.status(403).json({ error: "Permissão negada" });

  const { numero } = req.params;
  const { status } = req.body;
  const pedido = pedidos.find((p) => p.numero == numero);
  if (!pedido) return res.status(404).json({ error: "Pedido não encontrado" });

  pedido.status = status;
  pedido.atualizadoEm = new Date().toLocaleString();
  res.json({ message: "Status atualizado!", pedido });
});

// Listar pedidos (todos podem ver)
app.get("/pedidos", autenticar, (req, res) => {
  res.json(pedidos);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
