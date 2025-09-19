const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || "hamburguer-cec";

app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public"));

// Usuários e roles
const users = [
  { username: "atendente1", password: "123", role: "atendente" },
  { username: "cozinha1", password: "123", role: "cozinha" },
  { username: "despachante1", password: "123", role: "despachante" },
  { username: "admin", password: "admin123", role: "admin" },
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

// Middleware autenticação
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

// Criar pedido (apenas atendente)
app.post("/pedidos", autenticar, (req, res) => {
  if (req.user.role !== "atendente")
    return res
      .status(403)
      .json({ error: "Apenas atendentes podem criar pedidos" });
  const { cliente, combos, refrigerantes, observacoes } = req.body;
  if (
    !cliente ||
    !Array.isArray(combos) ||
    !Array.isArray(refrigerantes) ||
    combos.length !== refrigerantes.length
  )
    return res.status(400).json({ error: "Dados inválidos" });

  const pedido = {
    numero: proximoNumero++,
    cliente,
    combos,
    refrigerantes,
    observacoes: observacoes || "",
    status: "pendente",
    criadoEm: new Date().toLocaleString(),
  };
  pedidos.push(pedido);
  res.json({ message: "Pedido criado com sucesso!", pedido });
});

// Atualizar status
app.put("/pedidos/:numero", autenticar, (req, res) => {
  const { numero } = req.params;
  const { status } = req.body;
  const pedido = pedidos.find((p) => p.numero == numero);
  if (!pedido) return res.status(404).json({ error: "Pedido não encontrado" });

  if (req.user.role === "cozinha" && status === "em preparo")
    pedido.status = "em preparo";
  else if (req.user.role === "despachante" && status === "entregue")
    pedido.status = "entregue";
  else return res.status(403).json({ error: "Permissão negada" });

  res.json({ message: "Status atualizado!", pedido });
});

// Listar pedidos
app.get("/pedidos", autenticar, (req, res) => {
  res.json(pedidos);
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
