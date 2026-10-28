const { Op } = require("sequelize");
const sequelize = require("../database");
const Aporte = require("../../models/Aporte");
const Saque = require("../../models/Saque");
const User = require("../../models/User");
const Return = require("../../models/Return");
const Repasse = require("../../models/Repasse");

// Dinheiro sempre somado em centavos inteiros (0,10 + 0,20 = 0,30 exato).
// O SQLite dos testes guarda DECIMAL como float, então não confiar no banco.
const centavos = (v) => Math.round(Number(v || 0) * 100);
const reais = (c) => c / 100;

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

const dataBR = (iso) => {
  const [a, m, d] = String(iso || "").split("-");
  return d ? `${d}/${m}/${a}` : String(iso || "");
};

function serializar(a) {
  return {
    id: a.id,
    userId: a.userId,
    nome: a.User ? a.User.name : undefined,
    valor: reais(centavos(a.valor)),
    data_recebimento: a.data_recebimento,
    observacao: a.observacao,
    somado_ao_aportado: a.somado_ao_aportado,
    createdAt: a.createdAt,
  };
}

// POST /aportes — admin registra um aporte recebido na conta da gestora.
// historico=true: aporte antigo, já incluso no valor_aportado (só registra).
// Senão soma no valor_aportado (base do cálculo de rendimento) na mesma transação.
exports.criar = async (req, res) => {
  try {
    const { userId, valor, data_recebimento, observacao, historico } = req.body || {};

    const n = Number(valor);
    if (!Number.isFinite(n) || n <= 0 || n >= 1e13) {
      return res.status(400).json({ error: "Valor inválido." });
    }
    if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) {
      return res.status(400).json({ error: "Valor com mais de 2 casas decimais." });
    }
    if (!DATA_ISO.test(String(data_recebimento || "")) ||
        Number.isNaN(new Date(`${data_recebimento}T00:00:00`).getTime())) {
      return res.status(400).json({ error: "Data de recebimento inválida." });
    }

    const resultado = await sequelize.transaction(async (transaction) => {
      const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!user || user.token !== "user") return null;

      const somar = historico !== true;
      const aporte = await Aporte.create(
        {
          userId,
          valor: reais(centavos(n)),
          data_recebimento,
          observacao: String(observacao || "").trim().slice(0, 500) || null,
          somado_ao_aportado: somar,
        },
        { transaction }
      );

      if (somar) {
        await user.update(
          {
            valor_aportado: reais(centavos(user.valor_aportado) + centavos(n)),
            data_modificacao: new Date(),
          },
          { transaction }
        );
      }

      return { aporte, valor_aportado: Number(user.valor_aportado) };
    });

    if (!resultado) return res.status(404).json({ error: "Investidor não encontrado." });

    res.status(201).json({
      aporte: serializar(resultado.aporte),
      valor_aportado: resultado.valor_aportado,
    });
  } catch (err) {
    console.error("[aportes.criar] erro:", err);
    res.status(500).json({ error: "Erro ao registrar aporte." });
  }
};

// GET /aportes?userId= — lista para conferência do admin (mais recentes primeiro)
exports.listar = async (req, res) => {
  try {
    const where = {};
    if (req.query.userId) where.userId = String(req.query.userId);

    const aportes = await Aporte.findAll({
      where,
      include: [{ model: User, attributes: ["name"] }],
      order: [
        ["data_recebimento", "DESC"],
        ["id", "DESC"],
      ],
    });

    res.json(aportes.map(serializar));
  } catch (err) {
    console.error("[aportes.listar] erro:", err);
    res.status(500).json({ error: "Erro ao buscar aportes." });
  }
};

// GET /aportes/extrato/:userId — aportes, saques e rendimentos recebidos, numa lista só.
// Rendimento = 1 linha por repasse fechado, valor líquido (mesma regra 70/30
// do resto do sistema, aplicada sobre a soma de Return.rendimento do repasse).
exports.extrato = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: "Investidor não encontrado." });

    const [aportes, saques, repasses, lancamentos] = await Promise.all([
      Aporte.findAll({ where: { userId } }),
      Saque.findAll({ where: { userId } }),
      Repasse.findAll({ where: { userId } }),
      Return.findAll({
        where: { userId, repasseId: { [Op.ne]: null } },
        attributes: ["repasseId", "rendimento"],
      }),
    ]);

    const brutoPorRepasse = new Map();
    for (const r of lancamentos) {
      brutoPorRepasse.set(
        r.repasseId,
        (brutoPorRepasse.get(r.repasseId) || 0) + Number(r.rendimento || 0)
      );
    }

    const linhas = [
      ...aportes.map((a) => ({
        id: `aporte-${a.id}`,
        data: a.data_recebimento,
        tipo: "aporte",
        descricao: a.observacao || "Aporte recebido",
        centavos: centavos(a.valor),
      })),
      ...saques.map((s) => ({
        id: `saque-${s.id}`,
        data: s.data_saque,
        tipo: "saque",
        descricao: s.observacao || "Saque realizado",
        centavos: centavos(s.valor),
      })),
      ...repasses.map((r) => ({
        id: `repasse-${r.id}`,
        data: r.dataFim,
        tipo: "rendimento",
        descricao: `${r.numero}º Repasse · ${dataBR(r.dataInicio)} a ${dataBR(r.dataFim)}`,
        centavos: Math.round((brutoPorRepasse.get(r.id) || 0) * 0.7 * 100),
      })),
    ].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));

    const soma = (tipo) =>
      linhas.filter((l) => l.tipo === tipo).reduce((s, l) => s + l.centavos, 0);

    res.json({
      totais: {
        aportado: reais(soma("aporte")),
        sacado: reais(soma("saque")),
        rendimentos: reais(soma("rendimento")),
      },
      lancamentos: linhas.map(({ centavos: c, ...l }) => ({ ...l, valor: reais(c) })),
    });
  } catch (err) {
    console.error("[aportes.extrato] erro:", err);
    res.status(500).json({ error: "Erro ao montar o extrato." });
  }
};
