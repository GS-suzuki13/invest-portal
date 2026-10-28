const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../../models/User");
const { pick } = require("../utils/pick");
const { invalidarPapel } = require("../middlewares/auth");

// Hash bcrypt de uma senha qualquer: usado quando o usuário não existe, para a
// resposta levar o mesmo tempo (não revela quais logins existem).
const HASH_FICTICIO = bcrypt.hashSync("senha-ficticia", 10);

const USER_CREATE_FIELDS = [
  "id", "user", "password", "token", "name", "cpf", "email",
  "data_cadastro", "data_modificacao", "valor_aportado", "percentual_contrato",
];
const USER_UPDATE_FIELDS = [
  "name", "cpf", "email", "valor_aportado", "percentual_contrato",
];

// GET dados do próprio usuário autenticado
exports.me = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password"] },
    });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    res.json(user);
  } catch (err) {
    console.error("[users.me] erro:", err);
    res.status(500).json({ error: "Erro ao buscar usuário" });
  }
};

// POST /users/me/onboarding — registra que o próprio usuário concluiu/pulou o
// tutorial de onboarding (versão informada no corpo). Idempotente.
exports.marcarOnboarding = async (req, res) => {
  try {
    const versao = String(req.body?.versao ?? "").trim() || "1";

    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    await user.update({ onboarding_versao: versao });
    res.json({ onboarding_versao: versao });
  } catch (err) {
    console.error("[users.marcarOnboarding] erro:", err);
    res.status(500).json({ error: "Erro ao registrar o onboarding" });
  }
};

// GET todos os usuários
exports.getAll = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ["password"] },
    });
    res.json(users);
  } catch (err) {
    console.error("[users.getAll] erro:", err);
    res.status(500).json({ error: "Erro ao buscar usuários" });
  }
};

// POST novo usuário
exports.create = async (req, res) => {
  try {
    const dados = pick(req.body, USER_CREATE_FIELDS);

    // Normaliza campos numéricos: o front pode mandar "" ou NaN quando o
    // campo fica em branco, o que quebra a coluna FLOAT no MySQL.
    for (const campo of ["valor_aportado", "percentual_contrato"]) {
      if (campo in dados) {
        const n = Number(dados[campo]);
        if (!Number.isFinite(n)) delete dados[campo];
        else dados[campo] = n;
      }
    }

    const user = await User.create(dados);
    const { password: _omit, ...safeUser } = user.toJSON();
    res.json({ success: true, user: safeUser });

  } catch (err) {
    // Erros de negócio esperados: log enxuto, sem stack.
    if (err.name === "SequelizeUniqueConstraintError") {
      const campo = err.errors?.[0]?.path || "campo";
      console.warn(`[users.create] duplicidade em "${campo}" — respondendo 409`);
      return res
        .status(409)
        .json({ error: `Já existe um cadastro com esse ${campo}.` });
    }
    if (err.name === "SequelizeValidationError") {
      const msg =
        err.errors?.map((e) => e.message).join("; ") || "Dados inválidos";
      console.warn(`[users.create] validação: ${msg} — respondendo 400`);
      return res.status(400).json({ error: msg });
    }

    // Só aqui é erro de verdade — aí sim o stack completo.
    // detalhe técnico só no log do servidor (não vaza SQL/estrutura para o cliente)
    console.error("[users.create] erro inesperado:", err);
    res.status(500).json({ error: "Erro ao criar usuário" });
  }
};

// PUT editar usuário
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const found = await User.findByPk(id);
    if (!found) return res.status(404).json({ error: "Usuário não encontrado" });

    await found.update({
      ...pick(req.body, USER_UPDATE_FIELDS),
      data_modificacao: new Date(),
    });
    invalidarPapel(found.id);

    const { password: _omit, ...safeUser } = found.toJSON();
    res.json({ success: true, user: safeUser });
  } catch (err) {
    console.error("[users.update] erro:", err);
    res.status(500).json({ error: "Erro ao editar usuário" });
  }
};

// DELETE
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const found = await User.findByPk(id);
    if (!found) return res.status(404).json({ error: "Usuário não encontrado" });

    await found.destroy();
    invalidarPapel(found.id); // tokens dessa conta param de funcionar na hora
    res.json({ success: true });
  } catch (err) {
    console.error("[users.remove] erro:", err);
    res.status(500).json({ error: "Erro ao excluir usuário" });
  }
};

// LOGIN
exports.login = async (req, res) => {
  try {
    const { user, password } = req.body || {};

    // só texto: objeto/array no lugar do usuário ou da senha não chega no banco nem no bcrypt
    if (typeof user !== "string" || typeof password !== "string" || !user || !password) {
      return res.status(401).json({ error: "Usuário ou senha inválidos" });
    }

    // busca pelo username
    const found = await User.findOne({ where: { user } });
    if (!found) {
      await bcrypt.compare(password, HASH_FICTICIO); // mesmo tempo de resposta
      return res.status(401).json({ error: "Usuário ou senha inválidos" });
    }
    if (!(await found.validatePassword(password))) {
      return res.status(401).json({ error: "Usuário ou senha inválidos" });
    }

    // Migração transparente: converte senha em texto puro para hash no primeiro login
    if (!User.isBcryptHash(found.password)) {
      found.password = password;
      found.changed("password", true); // garante que o hook beforeUpdate gere o hash
      await found.save();
    }

    const role = found.token;

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("JWT_SECRET não configurado — não é possível emitir token");
      return res.status(500).json({ error: "Configuração de autenticação ausente" });
    }

    const accessToken = jwt.sign(
      { sub: found.id, role },
      secret,
      { algorithm: "HS256", expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    res.json({
      id: found.id,
      user: found.user,
      name: found.name,
      cpf: found.cpf,
      email: found.email,
      data_cadastro: found.data_cadastro,
      data_modificacao: found.data_modificacao,
      valor_aportado: found.valor_aportado,
      percentual_contrato: found.percentual_contrato,
      token: role, // papel do usuário: "adm" | "user"
      accessToken, // JWT para autenticar as demais requisições
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro no login" });
  }
};
