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
const SECRET_KEY = process.env.JWT_SECRET || "hamburguer-cec";

app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public"));

// Conexão Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

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

// ----- ROTAS -----

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const { data: users, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .eq("password", password);

  if (error || users.length === 0)
    return res.status(401).json({ error: "Usuário ou senha inválidos" });

  const user = users[0];
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET_KEY,
    { expiresIn: "4h" }
  );

  res.json({ token, role: user.role });
});

// Criar pedido (somente atendente)
app.post("/pedidos", autenticar, async (req, res) => {
  const { role, id: userId } = req.user;
  if (!["atendente", "admin"].includes(role))
    return res.status(403).json({ error: "Permissão negada" });

  const { cliente, combos, refrigerantes } = req.body;

  try {
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert([{ cliente, status: "pendente" }])
      .select("*")
      .single();

    if (orderError) throw orderError;

    const items = refrigerantes.map((ref, index) => ({
      order_id: order.id,
      item_index: index + 1,
      refrigerante: ref,
    }));
    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(items);

    if (itemsError) throw itemsError;

    io.emit("pedidoCriado", { ...order, refrigerantes }); // envia tempo real
    res.json({
      message: "Pedido criado com sucesso!",
      pedido: { ...order, refrigerantes },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar pedido" });
  }
});

// Atualizar status do pedido
app.put("/pedidos/:id", autenticar, async (req, res) => {
  const { role } = req.user;
  const { id } = req.params;
  const { status } = req.body;

  const permitido = {
    cozinha: ["preparing", "completed"],
    despachante: ["delivered"],
    admin: ["pendente", "preparing", "completed", "delivered"],
  };

  if (!permitido[role]?.includes(status))
    return res.status(403).json({ error: "Permissão negada" });

  try {
    const { data: order, error } = await supabase
      .from("orders")
      .update({ status, atualizado_em: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    // buscar refrigerantes
    const { data: items } = await supabase
      .from("order_items")
      .select("refrigerante")
      .eq("order_id", id);

    io.emit("pedidoAtualizado", {
      ...order,
      refrigerantes: items.map((i) => i.refrigerante),
    });
    res.json({
      message: "Status atualizado!",
      pedido: { ...order, refrigerantes: items.map((i) => i.refrigerante) },
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
    const pedidos = await Promise.all(
      orders.map(async (o) => {
        const { data: items } = await supabase
          .from("order_items")
          .select("refrigerante")
          .eq("order_id", o.id);
        return { ...o, refrigerantes: items.map((i) => i.refrigerante) };
      })
    );
    res.json(pedidos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao listar pedidos" });
  }
});

// ----- SOCKET.IO -----
io.on("connection", (socket) => {
  console.log("Usuário conectado:", socket.id);
});

// ----- INICIAR SERVIDOR -----
httpServer.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
