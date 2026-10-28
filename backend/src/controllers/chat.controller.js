const Message = require("../../models/Message");
const User = require("../../models/User");
const Evento = require("../../models/Evento");
const { Op, fn, col } = require("sequelize");
const { gerarRecorrencias, hojeBrasil, somarDias } = require("../services/recorrenciaEventos");

const AVISO_DIAS_ANTES = 3;

// O sino do admin consulta o resumo a cada 20 s; a recorrência de eventos
// muda no máximo uma vez por dia, então roda no máximo 1x/min por esse caminho
// (criar/editar evento continua gerando na hora).
const RECORRENCIA_A_CADA_MS = 60_000;
let ultimaRecorrencia = 0;

// Última mensagem de cada conversa em 2 consultas (antes: 1 consulta por
// cliente). id é sequencial, então o maior id da conversa é a mais recente.
async function ultimasMensagens(userIds) {
  const mapa = new Map();
  if (!userIds.length) return mapa;

  const maiores = await Message.findAll({
    where: { userId: userIds },
    attributes: ["userId", [fn("MAX", col("id")), "ultimoId"]],
    group: ["userId"],
    raw: true,
  });
  if (!maiores.length) return mapa;

  const ultimas = await Message.findAll({
    where: { id: maiores.map((m) => m.ultimoId) },
  });
  for (const m of ultimas) mapa.set(m.userId, m);
  return mapa;
}

const MAX_TEXTO = 2000;
const ehAdmin = (req) => req.user && req.user.role === "adm";

function serializar(m) {
  return {
    id: m.id,
    userId: m.userId,
    autor: m.autor,
    texto: m.texto,
    lida: m.lida,
    createdAt: m.createdAt,
  };
}

// Marca como lidas as mensagens destinadas a quem está lendo a conversa.
async function marcarLidas(userId, leitor /* "cliente" | "admin" */) {
  const autorContrario = leitor === "admin" ? "cliente" : "admin";
  await Message.update(
    { lida: true },
    { where: { userId, autor: autorContrario, lida: false } }
  );
}

// GET /chat/:userId — mensagens da conversa (investidor vê a dele; admin vê qualquer uma)
exports.mensagens = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: "Cliente não encontrado" });

    await marcarLidas(userId, ehAdmin(req) ? "admin" : "cliente");

    const mensagens = await Message.findAll({
      where: { userId },
      order: [["createdAt", "ASC"]],
    });

    res.json(mensagens.map(serializar));
  } catch (err) {
    console.error("[chat.mensagens] erro:", err);
    res.status(500).json({ error: "Erro ao carregar as mensagens" });
  }
};

// POST /chat/:userId — envia uma mensagem { texto }
exports.enviar = async (req, res) => {
  try {
    const { userId } = req.params;
    const texto = String(req.body?.texto ?? "").trim();

    if (!texto) return res.status(400).json({ error: "Mensagem vazia" });
    if (texto.length > MAX_TEXTO) {
      return res
        .status(400)
        .json({ error: `Mensagem muito longa (máx. ${MAX_TEXTO} caracteres)` });
    }

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: "Cliente não encontrado" });

    const msg = await Message.create({
      userId,
      autor: ehAdmin(req) ? "admin" : "cliente",
      texto,
      lida: false,
    });

    res.status(201).json(serializar(msg));
  } catch (err) {
    console.error("[chat.enviar] erro:", err);
    res.status(500).json({ error: "Erro ao enviar a mensagem" });
  }
};

// GET /chat/resumo — contadores para o sino de notificações (os dois papéis)
exports.resumo = async (req, res) => {
  try {
    if (!ehAdmin(req)) {
      const chatNaoLidas = await Message.count({
        where: { userId: req.user.id, autor: "admin", lida: false },
      });
      return res.json({ chatNaoLidas });
    }

    // admin: agrupa mensagens não lidas por cliente + eventos pendentes
    const naoLidas = await Message.findAll({
      where: { autor: "cliente", lida: false },
      attributes: ["userId"],
    });

    const contagem = {};
    for (const m of naoLidas) contagem[m.userId] = (contagem[m.userId] || 0) + 1;
    const ids = Object.keys(contagem);

    const usuarios = ids.length
      ? await User.findAll({ where: { id: ids }, attributes: ["id", "name"] })
      : [];

    const ultimas = await ultimasMensagens(usuarios.map((u) => u.id));
    const conversas = [];
    for (const u of usuarios) {
      const ultima = ultimas.get(u.id);
      conversas.push({
        userId: u.id,
        nome: u.name,
        naoLidas: contagem[u.id],
        ultimaMensagem: ultima ? ultima.texto.slice(0, 120) : "",
        ultimaData: ultima ? ultima.createdAt : null,
      });
    }
    conversas.sort(
      (a, b) => new Date(b.ultimaData || 0) - new Date(a.ultimaData || 0)
    );

    // sino: pendentes que vencem em até 3 dias (ou já venceram) e que o admin
    // ainda não clicou
    if (Date.now() - ultimaRecorrencia >= RECORRENCIA_A_CADA_MS) {
      ultimaRecorrencia = Date.now();
      await gerarRecorrencias();
    }
    const eventosAviso = await Evento.findAll({
      where: {
        status: "pendente",
        notificacao_vista_em: null,
        data: { [Op.lte]: somarDias(hojeBrasil(), AVISO_DIAS_ANTES) },
      },
      attributes: ["id", "nome", "data"],
      order: [["data", "ASC"]],
    });

    res.json({
      chatNaoLidas: naoLidas.length,
      conversas,
      eventosPendentes: eventosAviso.length,
      eventos: eventosAviso.slice(0, 20),
    });
  } catch (err) {
    console.error("[chat.resumo] erro:", err);
    res.status(500).json({ error: "Erro ao carregar as notificações" });
  }
};

// GET /chat/conversas — lista completa para a tela de mensagens do admin
exports.conversas = async (req, res) => {
  try {
    const clientes = await User.findAll({
      where: { token: "user" },
      attributes: ["id", "name", "email"],
      order: [["name", "ASC"]],
    });

    const naoLidas = await Message.findAll({
      where: { autor: "cliente", lida: false },
      attributes: ["userId"],
    });
    const contagem = {};
    for (const m of naoLidas) contagem[m.userId] = (contagem[m.userId] || 0) + 1;

    const ultimas = await ultimasMensagens(clientes.map((c) => c.id));
    const lista = [];
    for (const c of clientes) {
      const ultima = ultimas.get(c.id);
      lista.push({
        userId: c.id,
        nome: c.name,
        email: c.email,
        naoLidas: contagem[c.id] || 0,
        ultimaMensagem: ultima ? ultima.texto.slice(0, 120) : "",
        ultimaData: ultima ? ultima.createdAt : null,
      });
    }

    lista.sort((a, b) => {
      const ta = a.ultimaData ? new Date(a.ultimaData).getTime() : 0;
      const tb = b.ultimaData ? new Date(b.ultimaData).getTime() : 0;
      return tb - ta;
    });

    res.json(lista);
  } catch (err) {
    console.error("[chat.conversas] erro:", err);
    res.status(500).json({ error: "Erro ao carregar as conversas" });
  }
};
