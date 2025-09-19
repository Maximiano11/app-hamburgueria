require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET;

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// ------------------- Autenticação -------------------
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .single();

  if (!user || user.password !== password) {
    return res.status(401).json({ error: "Usuário ou senha inválidos" });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET_KEY,
    { expiresIn: "4h" }
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

// ------------------- Pedidos -------------------

// Função para gerar próximo número de pedido
async function gerarProximoNumero() {
  const { data, error } = await supabase
    .from("orders")
    .select("numero")
    .order("numero", { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return 1;
  return data.numero + 1;
}

// Criar pedido (Atendente/Admin)
app.post("/pedidos", autenticar, async (req, res) => {
  try {
    if (req.user.role !== "atendente" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Permissão negada" });
    }

    const { cliente, combos, refrigerantes, observacoes } = req.body;
    if (
      !cliente ||
      !combos ||
      !refrigerantes ||
      refrigerantes.length !== combos
    ) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    // Inserir pedido
    const numero = await gerarProximoNumero();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert([{ numero, cliente, status: "pendente" }])
      .select()
      .single();
    if (orderError) throw orderError;

    // Inserir itens
    for (let i = 0; i < combos; i++) {
      const { error: itemError } = await supabase
        .from("order_items")
        .insert([
          {
            order_id: order.id,
            item_index: i + 1,
            refrigerante: refrigerantes[i],
          },
        ]);
      if (itemError) throw itemError;
    }

    io.emit("novoPedido", order); // tempo real
    res.json({ message: "Pedido criado com sucesso!", pedido: order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar pedido" });
  }
});

// Atualizar status (Cozinha/Despachante/Admin)
app.put("/pedidos/:numero", autenticar, async (req, res) => {
  try {
    const { numero } = req.params;
    const { status } = req.body;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("numero", numero)
      .single();

    if (orderError || !order)
      return res.status(404).json({ error: "Pedido não encontrado" });

    // Verifica permissão
    if (
      req.user.role === "cozinha" &&
      !["em preparo", "concluido"].includes(status)
    ) {
      return res.status(403).json({ error: "Permissão negada" });
    }
    if (req.user.role === "despachante" && status !== "entregue") {
      return res.status(403).json({ error: "Permissão negada" });
    }

    if (req.user.role === "atendente" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Permissão negada" });
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({ status, atualizado_em: new Date().toISOString() })
      .eq("numero", numero);
    if (updateError) throw updateError;

    io.emit("atualizarPedido", { numero, status });
    res.json({ message: "Status atualizado com sucesso!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar status" });
  }
});

// Listar pedidos (todos logados)
app.get("/pedidos", autenticar, async (req, res) => {
  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      order_items(*)
    `
    )
    .order("numero", { ascending: true });
  if (error) return res.status(500).json({ error: "Erro ao listar pedidos" });
  res.json(orders);
});

// ------------------- Socket.IO -------------------
io.on("connection", (socket) => {
  console.log("Novo usuário conectado:", socket.id);
});

// ------------------- Start Server -------------------
httpServer.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
