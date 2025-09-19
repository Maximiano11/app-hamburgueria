require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { createClient } = require("@supabase/supabase-js");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ===== Autenticação =====
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .single();

  if (error || !user)
    return res.status(401).json({ error: "Usuário ou senha inválidos" });

  const senhaValida = password === user.password; // ou bcrypt.compare(password, user.password) se criptografado
  if (!senhaValida)
    return res.status(401).json({ error: "Usuário ou senha inválidos" });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET_KEY,
    {
      expiresIn: "8h",
    }
  );

  res.json({ token, role: user.role });
});

// Middleware JWT
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

// ===== Pedidos =====

// Criar pedido (somente atendente)
app.post("/pedidos", autenticar, async (req, res) => {
  if (req.user.role !== "atendente" && req.user.role !== "admin")
    return res.status(403).json({ error: "Permissão negada" });

  const { cliente, combos, refrigerantes, observacoes } = req.body;
  try {
    // pegar o último numero de pedido
    const { data: lastOrder } = await supabase
      .from("orders")
      .select("numero")
      .order("numero", { ascending: false })
      .limit(1)
      .single();
    const numero = lastOrder ? lastOrder.numero + 1 : 1;

    // criar pedido
    const { data: order } = await supabase
      .from("orders")
      .insert([{ numero, cliente, observacoes, status: "pendente" }])
      .select("*")
      .single();

    // criar itens
    const items = refrigerantes.map((r, index) => ({
      order_id: order.id,
      item_index: index + 1,
      refrigerante: r,
    }));

    await supabase.from("order_items").insert(items);

    io.emit("update", await carregarPedidos());
    res.json({ message: "Pedido criado!", order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar pedido" });
  }
});

// Atualizar status do pedido
app.put("/pedidos/:numero", autenticar, async (req, res) => {
  const { numero } = req.params;
  const { status } = req.body;

  try {
    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("numero", numero)
      .single();

    if (!order) return res.status(404).json({ error: "Pedido não encontrado" });

    // Verificar permissões
    if (
      (req.user.role === "cozinha" &&
        !["em preparo", "concluido"].includes(status)) ||
      (req.user.role === "despachante" && status !== "entregue") ||
      (req.user.role === "atendente" && req.user.role !== "admin")
    )
      return res.status(403).json({ error: "Permissão negada" });

    await supabase
      .from("orders")
      .update({ status, atualizado_em: new Date() })
      .eq("id", order.id);

    io.emit("update", await carregarPedidos());
    res.json({ message: "Status atualizado!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar status" });
  }
});

// Buscar todos pedidos (usado pelo socket)
async function carregarPedidos() {
  const { data: orders } = await supabase.from("orders").select("*");
  return orders;
}

// ===== Socket.IO =====
io.on("connection", async (socket) => {
  socket.emit("update", await carregarPedidos());
});

// ===== Iniciar servidor =====
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
