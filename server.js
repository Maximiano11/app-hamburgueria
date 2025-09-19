const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");
const http = require("http");
const { Server } = require("socket.io");

require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "hamburguer-cec";

// Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// Middleware JWT
function autenticar(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader)
    return res.status(401).json({ error: "Token não fornecido" });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Token inválido" });
    req.user = user;
    next();
  });
}

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .eq("password", password)
    .single();

  if (error || !data)
    return res.status(401).json({ error: "Usuário ou senha inválidos" });

  const token = jwt.sign(
    { id: data.id, username: data.username, role: data.role },
    JWT_SECRET,
    { expiresIn: "4h" }
  );
  res.json({ token, role: data.role });
});

// Criar pedido (somente atendente)
app.post("/pedidos", autenticar, async (req, res) => {
  try {
    if (!["atendente", "admin"].includes(req.user.role))
      return res.status(403).json({ error: "Permissão negada" });

    const { cliente, itens, observacoes } = req.body;

    // Inserir pedido
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({ cliente, status: "pendente" })
      .select()
      .single();

    if (orderError) throw orderError;

    // Inserir itens
    for (let i = 0; i < itens.length; i++) {
      await supabase.from("order_items").insert({
        order_id: order.id,
        item_index: i + 1,
        refrigerante: itens[i],
      });
    }

    // Emitir novo pedido para todos clientes
    const { data: pedidos } = await supabase.from("orders").select("*");
    io.emit("updatePedidos", pedidos);

    res.json({ message: "Pedido criado!", pedido: order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar pedido" });
  }
});

// Atualizar status do pedido
app.put("/pedidos/:id", autenticar, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Regras de permissão
    const userRole = req.user.role;
    if (
      (status === "em preparo" && !["cozinha", "admin"].includes(userRole)) ||
      (status === "concluido" && !["cozinha", "admin"].includes(userRole)) ||
      (status === "entregue" && !["despachante", "admin"].includes(userRole))
    )
      return res.status(403).json({ error: "Permissão negada" });

    const { data, error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id);
    if (error) throw error;

    const { data: pedidos } = await supabase.from("orders").select("*");
    io.emit("updatePedidos", pedidos);

    res.json({ message: "Status atualizado!", data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar status" });
  }
});

// Listar pedidos
app.get("/pedidos", autenticar, async (req, res) => {
  try {
    const { data: pedidos, error } = await supabase.from("orders").select("*");
    if (error) throw error;
    res.json(pedidos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao listar pedidos" });
  }
});

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
