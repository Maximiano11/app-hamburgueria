const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

// --- Configurações Supabase ---
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// --- Middleware ---
app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public"));

// --- Middleware de autenticação ---
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

// --- Endpoint para criar pedido ---
app.post("/pedidos", autenticar, async (req, res) => {
  try {
    const { username, role } = req.user;
    if (!["atendente", "admin"].includes(role)) {
      return res.status(403).json({ error: "Permissão negada" });
    }

    const { cliente, combos, refrigerantes, observacoes } = req.body;

    console.log("Criando pedido:", {
      cliente,
      combos,
      refrigerantes,
      observacoes,
      username,
    });

    // 1. Inserir pedido na tabela orders
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert([{ cliente, status: "pendente" }])
      .select()
      .single();

    if (orderError) {
      console.error("Erro ao inserir order:", orderError);
      return res.status(500).json({ error: orderError.message });
    }

    // 2. Inserir itens na tabela order_items
    const itensToInsert = [];
    for (let i = 0; i < combos; i++) {
      itensToInsert.push({
        order_id: orderData.id,
        item_index: i + 1,
        refrigerante: refrigerantes[i] || "Coca-Cola",
      });
    }

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(itensToInsert);
    if (itemsError) {
      console.error("Erro ao inserir order_items:", itemsError);
      return res.status(500).json({ error: itemsError.message });
    }

    res.json({ message: "Pedido criado com sucesso!", pedidoId: orderData.id });
  } catch (err) {
    console.error("Erro interno ao criar pedido:", err);
    res.status(500).json({ error: "Erro interno ao criar pedido" });
  }
});

// --- Inicializar servidor ---
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
