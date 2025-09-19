// server.js
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");
const http = require("http");
const { Server } = require("socket.io");

// ----- CONFIGURAÇÕES -----
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || "hamburguer-cec";

// Supabase
const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://krybnbkjuwhpjhykfjeb.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeWJuYmtqdXdocGpoeWtmamViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMTk2NDIsImV4cCI6MjA3Mzc5NTY0Mn0.1bGQXR4TOavZrqXMlsDCyh7q25tQ1bN81kXqseuoqRo";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ----- MIDDLEWARES -----
app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public"));

// ----- AUTENTICAÇÃO -----
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

  const { data: users, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .eq("password", password) // No futuro usar bcrypt
    .limit(1);

  if (!users || users.length === 0)
    return res.status(401).json({ error: "Usuário ou senha inválidos" });

  const user = users[0];
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET_KEY,
    { expiresIn: "4h" }
  );
  res.json({ token, role: user.role });
});

// Criar pedido (apenas Atendente)
app.post("/pedidos", autenticar, async (req, res) => {
  if (req.user.role !== "atendente" && req.user.role !== "admin")
    return res.status(403).json({ error: "Permissão negada" });

  const { cliente, combos, refrigerantes, observacoes } = req.body;

  try {
    // Inserir pedido
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert([{ cliente, status: "pendente" }])
      .select()
      .single();

    if (orderError) throw orderError;

    const orderId = orderData.id;

    // Inserir itens
    for (let i = 0; i < combos; i++) {
      await supabase
        .from("order_items")
        .insert([
          {
            order_id: orderId,
            item_index: i + 1,
            refrigerante: refrigerantes[i],
          },
        ]);
    }

    // Emitir atualização em tempo real
    const { data: pedidosAtualizados } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("id", { ascending: true });

    io.emit("update", pedidosAtualizados);

    res.json({ message: "Pedido criado com sucesso!", pedido: orderData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar pedido" });
  }
});

// Atualizar status do pedido (Cozinha e Despachante)
app.put("/pedidos/:id", autenticar, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (!order) return res.status(404).json({ error: "Pedido não encontrado" });

    // Regras de permissão
    if (
      req.user.role === "cozinha" &&
      !["em preparo", "concluido"].includes(status)
    ) {
      return res.status(403).json({ error: "Status inválido para Cozinha" });
    }
    if (req.user.role === "despachante" && status !== "entregue") {
      return res
        .status(403)
        .json({ error: "Status inválido para Despachante" });
    }
    if (req.user.role === "atendente" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Permissão negada" });
    }

    // Atualizar pedido
    const { data: updated } = await supabase
      .from("orders")
      .update({ status, atualizado_em: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    // Emitir atualização em tempo real
    const { data: pedidosAtualizados } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("id", { ascending: true });

    io.emit("update", pedidosAtualizados);

    res.json({ message: "Status atualizado!", pedido: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar status" });
  }
});

// Listar pedidos (todos os usuários)
app.get("/pedidos", autenticar, async (req, res) => {
  try {
    const { data: pedidos, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("id", { ascending: true });

    res.json(pedidos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao listar pedidos" });
  }
});

// ----- SOCKET.IO -----
io.on("connection", (socket) => {
  console.log("Novo usuário conectado: ", socket.id);
});

// ----- START SERVER -----
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
