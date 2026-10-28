const sequelize = require("../database");
const Saque = require("../../models/Saque");
const User = require("../../models/User");
const Message = require("../../models/Message");
const { montarMensagemSaque } = require("../services/mensagemSaque");

// Mesmas regras de dinheiro do aportes.controller: sempre em centavos inteiros.
const centavos = (v) => Math.round(Number(v || 0) * 100);
const reais = (c) => c / 100;

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function serializar(s) {
  return {
    id: s.id,
    userId: s.userId,
    nome: s.User ? s.User.name : undefined,
    valor: reais(centavos(s.valor)),
    data_saque: s.data_saque,
    observacao: s.observacao,
    descontado_do_aportado: s.descontado_do_aportado,
    createdAt: s.createdAt,
  };
}

// POST /saques — admin registra um saque pago ao investidor.
// historico=true: saque antigo, já descontado do valor_aportado (só registra).
// Senão subtrai do valor_aportado (base do cálculo de rendimento) na mesma
// transação e avisa o investidor pelo chat do site com a nova posição.
exports.criar = async (req, res) => {
  try {
    const { userId, valor, data_saque, observacao, historico } = req.body || {};

    const n = Number(valor);
    if (!Number.isFinite(n) || n <= 0 || n >= 1e13) {
      return res.status(400).json({ error: "Valor inválido." });
    }
    if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) {
      return res.status(400).json({ error: "Valor com mais de 2 casas decimais." });
    }
    if (!DATA_ISO.test(String(data_saque || "")) ||
        Number.isNaN(new Date(`${data_saque}T00:00:00`).getTime())) {
      return res.status(400).json({ error: "Data do saque inválida." });
    }

    const resultado = await sequelize.transaction(async (transaction) => {
      const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!user || user.token !== "user") return { status: 404 };

      const descontar = historico !== true;
      const anterior = centavos(user.valor_aportado);
      if (descontar && centavos(n) > anterior) return { status: 422 };

      const saque = await Saque.create(
        {
          userId,
          valor: reais(centavos(n)),
          data_saque,
          observacao: String(observacao || "").trim().slice(0, 500) || null,
          descontado_do_aportado: descontar,
        },
        { transaction }
      );

      if (descontar) {
        await user.update(
          {
            valor_aportado: reais(anterior - centavos(n)),
            data_modificacao: new Date(),
          },
          { transaction }
        );

        await Message.create(
          {
            userId,
            autor: "admin",
            texto: montarMensagemSaque({
              nome: user.name,
              data: data_saque,
              valorAnterior: reais(anterior),
              valorSaque: reais(centavos(n)),
              valorAtual: reais(anterior - centavos(n)),
            }),
            lida: false,
          },
          { transaction }
        );
      }

      return { saque, valor_aportado: Number(user.valor_aportado), avisado: descontar };
    });

    if (resultado.status === 404) return res.status(404).json({ error: "Investidor não encontrado." });
    if (resultado.status === 422) {
      return res.status(422).json({ error: "Saque maior que o valor aportado do investidor." });
    }

    res.status(201).json({
      saque: serializar(resultado.saque),
      valor_aportado: resultado.valor_aportado,
      avisado: resultado.avisado,
    });
  } catch (err) {
    console.error("[saques.criar] erro:", err);
    res.status(500).json({ error: "Erro ao registrar saque." });
  }
};

// GET /saques?userId= — lista para conferência do admin (mais recentes primeiro)
exports.listar = async (req, res) => {
  try {
    const where = {};
    if (req.query.userId) where.userId = String(req.query.userId);

    const saques = await Saque.findAll({
      where,
      include: [{ model: User, attributes: ["name"] }],
      order: [
        ["data_saque", "DESC"],
        ["id", "DESC"],
      ],
    });

    res.json(saques.map(serializar));
  } catch (err) {
    console.error("[saques.listar] erro:", err);
    res.status(500).json({ error: "Erro ao buscar saques." });
  }
};
