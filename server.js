const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || "hamburguer-cec";

// Config Supabase
const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://krybnbkjuwhpjhykfjeb.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeWJuYmtqdXdocGpoeWtmamViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMTk2NDIsImV4cCI6MjA3Mzc5NTY0Mn0.1bGQXR4TOavZrqXMlsDCyh7q25tQ1bN81kXqseuoqRo";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// --- Autenticação ---
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const { data: userData, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .single();

  if (error || !userData || userData.password !== password) {
    return res.status(401).json({ error: "Usuário ou senha inválidos" });
  }

  const token = jwt.sign(
    { id: userData.id, username, role: userData.role },
    SECRET_KEY,
    { expiresIn: "4h" }
  );
  res.json({ token, role: userData.role });
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

// --- Pedidos ---
app.post("/pedidos", autenticar, async (req, res) => {
  if (!["atendente", "admin"].includes(req.user.role))
    return res.status(403).json({ error: "Permissão negada" });

  const { cliente, combos, refrigerantes } = req.body;

  try {
    const { data: maxPedido } = await supabase
      .from("orders")
      .select("numero")
      .order("numero", { ascending: false })
      .limit(1)
      .single();

    const numeroPedido = maxPedido ? maxPedido.numero + 1 : 1;

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert([{ numero: numeroPedido, cliente }])
      .select()
      .single();

    if (orderError) throw orderError;

    // Inserir itens
    const itemsToInsert = refrigerantes.map((ref, index) => ({
      order_id: orderData.id,
      item_index: index + 1,
      refrigerante: ref,
    }));

    await supabase.from("order_items").insert(itemsToInsert);

    // Emitir via Socket.IO
    io.emit("novoPedido", {
      id: orderData.id,
      numero: numeroPedido,
      cliente,
      status: "pendente",
      combos,
      refrigerantes,
    });

    res.json({
      message: "Pedido criado com sucesso!",
      pedido: {
        numero: numeroPedido,
        cliente,
        status: "pendente",
        combos,
        refrigerantes,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar pedido" });
  }
});

// Atualizar status do pedido
app.put("/pedidos/:numero", autenticar, async (req, res) => {
  const { numero } = req.params;
  const { status } = req.body;

  const role = req.user.role;
  if (
    (role === "cozinha" && !["em preparo", "concluído"].includes(status)) ||
    (role === "despachante" && status !== "entregue") ||
    (role !== "admin" &&
      !["em preparo", "concluído", "entregue"].includes(status))
  ) {
    return res.status(403).json({ error: "Permissão negada" });
  }

  try {
    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("numero", numero)
      .single();

    if (!order) return res.status(404).json({ error: "Pedido não encontrado" });

    await supabase
      .from("orders")
      .update({ status, atualizado_em: new Date().toISOString() })
      .eq("id", order.id);

    // Emitir via Socket.IO
    io.emit("atualizarPedidos", { numero: order.numero, status });

    res.json({
      message: "Status atualizado!",
      pedido: { numero: order.numero, status },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar status" });
  }
});

// Listar pedidos
app.get("/pedidos", autenticar, async (req, res) => {
  try {
    const { data: orders } = await supabase
      .from("orders")
      .select("*")
      .order("criado_em", { ascending: false });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao listar pedidos" });
  }
});

// --- Socket.IO ---
io.on("connection", (socket) => {
  console.log("Novo usuário conectado");

  socket.on("disconnect", () => console.log("Usuário desconectado"));
});

// --- Iniciar servidor ---
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
