const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

// Variáveis de ambiente (no Render)
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || "hamburguer-cec";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public"));

// Inicializa Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Middleware de autenticação
async function autenticar(req, res, next) {
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
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .eq("password", password)
    .single();

  if (error || !user)
    return res.status(401).json({ error: "Usuário ou senha inválidos" });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET_KEY,
    { expiresIn: "4h" }
  );
  res.json({ token, role: user.role });
});

// Criar pedido (somente atendente)
app.post("/pedidos", autenticar, (req, res) => {
  console.log("=== Novo pedido recebido ===");
  console.log("Body recebido:", req.body);
  console.log("Usuário logado:", req.user);

  if (req.user.role !== "atendente") {
    return res
      .status(403)
      .json({
        error: "Permissão negada. Apenas atendentes podem criar pedidos.",
      });
  }

  const { cliente, combos, refrigerantes, observacoes } = req.body;

  // Validação básica
  if (!cliente || !Array.isArray(combos) || !Array.isArray(refrigerantes)) {
    return res
      .status(400)
      .json({
        error:
          "Dados inválidos. Certifique-se de enviar cliente, combos e refrigerantes corretamente.",
      });
  }

  if (combos.length !== refrigerantes.length) {
    return res
      .status(400)
      .json({ error: "O número de combos e refrigerantes deve ser igual." });
  }

  try {
    const pedido = {
      numero: proximoNumero++,
      cliente,
      combos,
      refrigerantes,
      observacoes: observacoes || "",
      status: "pendente",
      criadoEm: new Date().toLocaleString(),
    };

    pedidos.push(pedido);

    console.log("Pedido criado com sucesso:", pedido);

    return res
      .status(200)
      .json({ message: "Pedido criado com sucesso!", pedido });
  } catch (error) {
    console.error("Erro ao criar pedido:", error);
    return res.status(500).json({ error: "Erro interno ao criar pedido." });
  }
});

// Atualizar status do pedido (cozinha/despachante)
app.put("/pedidos/:id", autenticar, async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;

  if (!["cozinha", "despachante", "admin"].includes(req.user.role))
    return res.status(403).json({ error: "Permissão negada" });

  const { data, error } = await supabase
    .from("pedidos")
    .update({ status, atualizado_em: new Date() })
    .eq("id", id)
    .select();

  if (error) return res.status(500).json({ error: "Erro ao atualizar status" });

  res.json({ message: "Status atualizado!", pedido: data[0] });
});

// Listar pedidos (todos logados)
app.get("/pedidos", autenticar, async (req, res) => {
  const { data, error } = await supabase
    .from("pedidos")
    .select("*")
    .order("criado_em", { ascending: false });
  if (error) return res.status(500).json({ error: "Erro ao listar pedidos" });
  res.json(data);
});

// Inicia servidor
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
