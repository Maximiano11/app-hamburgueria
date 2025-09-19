const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const http = require("http");
const { Server } = require("socket.io");

// ----- CONFIGURAÇÕES -----
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3000;
const SECRET_KEY = "hamburguer-cec"; // em produção, usar variável de ambiente

app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public"));

// ----- SUPABASE -----
const supabaseUrl = "https://krybnbkjuwhpjhykfjeb.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeWJuYmtqdXdocGpoeWtmamViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMTk2NDIsImV4cCI6MjA3Mzc5NTY0Mn0.1bGQXR4TOavZrqXMlsDCyh7q25tQ1bN81kXqseuoqRo";
const supabase = createClient(supabaseUrl, supabaseKey);

// ----- AUTH -----
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .single();

  if (error || !user || user.password !== password) {
    return res.status(401).json({ error: "Usuário ou senha inválidos" });
  }

  const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, {
    expiresIn: "4h",
  });
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

// ----- PEDIDOS -----
// Criar pedido (somente atendente ou admin)
app.post("/pedidos", autenticar, async (req, res) => {
  if (req.user.role !== "atendente" && req.user.role !== "admin")
    return res.status(403).json({ error: "Permissão negada" });

  try {
    const { cliente, combos, refrigerantes } = req.body;

    // Cria pedido na tabela orders
    const { data: order, error } = await supabase
      .from("orders")
      .insert({ numero: Date.now(), cliente, status: "pendente" })
      .select()
      .single();

    if (error) throw error;

    // Cria itens do pedido
    for (let i = 0; i < combos; i++) {
      await supabase.from("order_items").insert({
        order_id: order.id,
        item_index: i + 1,
        refrigerante: refrigerantes[i],
      });
    }

    atualizarPedidosSocket();
    res.json({ message: "Pedido criado com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar pedido" });
  }
});

// Atualizar status do pedido (cozinha e despachante)
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

    // Regras de permissão
    if (
      req.user.role === "cozinha" &&
      !["em preparo", "concluido"].includes(status)
    )
      return res.status(403).json({ error: "Permissão negada" });
    if (req.user.role === "despachante" && status !== "entregue")
      return res.status(403).json({ error: "Permissão negada" });

    await supabase.from("orders").update({ status }).eq("id", order.id);
    atualizarPedidosSocket();
    res.json({ message: "Status atualizado!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar pedido" });
  }
});

// Listar pedidos
app.get("/pedidos", autenticar, async (req, res) => {
  const { data: orders } = await supabase.from("orders").select("*");
  res.json(orders);
});

// ----- SOCKET.IO -----
async function atualizarPedidosSocket() {
  const { data: orders } = await supabase.from("orders").select("*");
  io.emit("update", orders);
}

io.on("connection", (socket) => {
  console.log("Novo usuário conectado");
  atualizarPedidosSocket();
  socket.on("disconnect", () => console.log("Usuário desconectou"));
});

// ----- START SERVER -----
server.listen(PORT, () =>
  console.log(`Servidor rodando em https://hamburgueria-mezu.onrender.com`)
);
