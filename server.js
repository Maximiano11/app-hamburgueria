const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

// Variáveis de ambiente (configurar no Render)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SECRET_KEY = process.env.SECRET_KEY || "hamburguer-cec";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public"));

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

// ----- LOGIN -----
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .single();

  if (error || !user || user.password !== password)
    return res.status(401).json({ error: "Usuário ou senha inválidos" });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET_KEY,
    { expiresIn: "4h" }
  );

  res.json({ token, role: user.role });
});

// ----- CRIAR PEDIDO (Apenas Atendente) -----
app.post("/pedidos", autenticar, async (req, res) => {
  if (req.user.role !== "atendente" && req.user.role !== "admin")
    return res.status(403).json({ error: "Permissão negada" });

  const { cliente, combos, refrigerantes, observacoes } = req.body;
  try {
    // Inserir pedido na tabela orders
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert([{ numero: Date.now(), cliente, status: "pendente" }])
      .select()
      .single();

    if (orderErr) throw orderErr;

    // Inserir itens na tabela order_items
    const items = combos.map((_, i) => ({
      order_id: order.id,
      item_index: i + 1,
      refrigerante: refrigerantes[i],
    }));

    const { error: itemsErr } = await supabase
      .from("order_items")
      .insert(items);
    if (itemsErr) throw itemsErr;

    // Emitir para todos os clientes
    io.emit("novoPedido", { order, items });

    res.json({ message: "Pedido criado com sucesso!", order, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar pedido" });
  }
});

// ----- ATUALIZAR STATUS PEDIDO (Cozinha e Despachante) -----
app.put("/pedidos/:id/status", autenticar, async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;

  try {
    // Verifica permissão
    if (
      (req.user.role === "cozinha" &&
        !["em preparo", "concluido"].includes(status)) ||
      (req.user.role === "despachante" && status !== "entregue") ||
      (req.user.role !== "cozinha" &&
        req.user.role !== "despachante" &&
        req.user.role !== "admin")
    ) {
      return res.status(403).json({ error: "Permissão negada" });
    }

    const { error } = await supabase
      .from("orders")
      .update({ status, atualizado_em: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;

    // Emitir atualização em tempo real
    io.emit("atualizacaoPedido", { id, status });

    res.json({ message: "Status atualizado com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar status" });
  }
});

// ----- LISTAR PEDIDOS -----
app.get("/pedidos", autenticar, async (req, res) => {
  try {
    const { data: orders, error } = await supabase.from("orders").select("*");
    if (error) throw error;

    // Pegar itens de cada pedido
    const { data: items, error: itemsErr } = await supabase
      .from("order_items")
      .select("*");
    if (itemsErr) throw itemsErr;

    res.json({ orders, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao listar pedidos" });
  }
});

// ----- SOCKET.IO -----
io.on("connection", (socket) => {
  console.log("Novo cliente conectado:", socket.id);
});

// ----- INICIAR SERVIDOR -----
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
