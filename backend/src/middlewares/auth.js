const jwt = require("jsonwebtoken");
const User = require("../../models/User");

function getTokenFromHeader(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme === "Bearer" && token) return token;
  return null;
}

// Papel atual de cada usuário, lido do banco (não do token): conta excluída ou
// com papel trocado perde o acesso na hora, sem esperar o token expirar (7 dias).
// Cache curto para não ir ao banco em toda requisição; users.controller limpa a
// entrada ao editar/excluir.
const CACHE_MS = 30_000;
const papeis = new Map(); // id -> { role, expira }

async function papelAtual(id) {
  const hit = papeis.get(id);
  if (hit && hit.expira > Date.now()) return hit.role;

  const user = await User.findByPk(id, { attributes: ["id", "token"] });
  const role = user ? user.token : null;
  if (papeis.size > 5000) papeis.clear();
  papeis.set(id, { role, expira: Date.now() + CACHE_MS });
  return role;
}

function invalidarPapel(id) {
  papeis.delete(String(id));
}

// Exige um token JWT válido de um usuário que ainda existe; popula req.user = { id, role }
async function authRequired(req, res, next) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("JWT_SECRET não configurado — autenticação indisponível");
    return res.status(500).json({ error: "Configuração de autenticação ausente" });
  }

  const token = getTokenFromHeader(req);
  if (!token) return res.status(401).json({ error: "Token ausente" });

  let payload;
  try {
    payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }

  try {
    const role = typeof payload.sub === "string" ? await papelAtual(payload.sub) : null;
    if (!role) return res.status(401).json({ error: "Sessão encerrada" });
    req.user = { id: payload.sub, role };
  } catch (err) {
    console.error("[auth] erro ao conferir o usuário:", err);
    return res.status(500).json({ error: "Erro ao validar a sessão" });
  }
  return next();
}

// Exige token válido + papel de administrador
function adminRequired(req, res, next) {
  authRequired(req, res, () => {
    if (req.user.role !== "adm") {
      return res.status(403).json({ error: "Acesso restrito a administradores" });
    }
    return next();
  });
}

// Permite acesso se for admin OU se o recurso pertence ao próprio usuário.
// paramName: nome do parâmetro de rota que contém o id do dono (ex.: "id", "userId")
function selfOrAdmin(paramName) {
  return (req, res, next) => {
    authRequired(req, res, () => {
      if (req.user.role === "adm" || req.user.id === req.params[paramName]) {
        return next();
      }
      return res.status(403).json({ error: "Acesso negado" });
    });
  };
}

module.exports = { authRequired, adminRequired, selfOrAdmin, invalidarPapel };
