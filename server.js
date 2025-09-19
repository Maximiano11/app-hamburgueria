// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || "hamburguer-cec";

// Configurações
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // serve arquivos do front-end

// Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Middleware de autenticação JWT ---
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

// --- LOGIN ---
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .single();

    if (error || !user || user.password !== password) {
      return res.status(401).json({ error: "Usuário ou senha inválidos" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      SECRET_KEY,
      { expiresIn: "4h" }
    );

    res.json({ token, role: user.role, username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro no login" });
  }
});

// --- ROTAS DE PEDIDOS ---
// Criar pedido (apenas atendente e admin)
app.post("/pedidos", autenticar, async (req, res) => {
  const { role } = req.user;
  if (!["atendente", "admin"].includes(role)) {
    return res.status(403).json({ error: "Permissão negada" });
  }

  const { cliente, combos } = req.body; // combos = [{ itemIndex, refrigerante }, ...]

  try {
    // Criar pedido
    const { data: lastOrder } = await supabase
      .from("orders")
      .select("*")
      .order("numero", { ascending: false })
      .limit(1)
      .single();

    const numero = lastOrder ? lastOrder.numero + 1 : 1;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert([{ numero, cliente, status: "pendente" }])
      .single();

    if (orderError) throw orderError;

    // Inserir itens
    for (let item of combos) {
      await supabase.from("order_items").insert([
        {
          order_id: order.id,
          item_index: item.itemIndex,
          refrigerante: item.refrigerante,
        },
      ]);
    }

    res.json({ message: "Pedido criado com sucesso!", pedido: order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar pedido" });
  }
});

// Atualizar status do pedido (cozinha, despachante e admin)
app.put("/pedidos/:numero", autenticar, async (req, res) => {
  const { numero } = req.params;
  const { status } = req.body;
  const { role } = req.user;

  try {
    // Buscar pedido
    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("numero", numero)
      .single();

    if (error || !order)
      return res.status(404).json({ error: "Pedido não encontrado" });

    // Verifica permissão
    const allowedRoles = {
      cozinha: ["em preparo", "concluido"],
      despachante: ["entregue"],
      admin: ["pendente", "em preparo", "concluido", "entregue"],
    };

    if (!allowedRoles[role]?.includes(status) && role !== "admin") {
      return res
        .status(403)
        .json({ error: "Permissão negada para este status" });
    }

    const { data, error: updateError } = await supabase
      .from("orders")
      .update({ status, atualizado_em: new Date().toISOString() })
      .eq("numero", numero)
      .single();

    if (updateError) throw updateError;

    res.json({ message: "Status atualizado!", pedido: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar status" });
  }
});

// Listar pedidos (todos podem ver)
app.get("/pedidos", autenticar, async (req, res) => {
  try {
    const { data: orders, error } = await supabase.from("orders").select("*");
    if (error) throw error;
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao listar pedidos" });
  }
});

// --- INICIAR SERVIDOR ---
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
