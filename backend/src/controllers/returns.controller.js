const { Op } = require("sequelize");
const Return = require("../../models/Return");
const User = require("../../models/User");

const ISO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const dataBR = (iso) => String(iso).split("-").reverse().join("/");

// Acha o lançamento pelo id (o jeito certo) ou, por compatibilidade com
// clientes antigos, pela data — só quando há um único lançamento naquele dia.
async function acharRendimento(userId, ref) {
  if (/^\d+$/.test(ref)) {
    return { rendimento: await Return.findOne({ where: { id: Number(ref), userId } }) };
  }
  const doDia = await Return.findAll({ where: { userId, data: ref }, limit: 2 });
  if (doDia.length > 1) return { ambiguo: true };
  return { rendimento: doDia[0] || null };
}

exports.getAll = async (req, res) => {
  try {
    const { id: userId } = req.params;

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        error: "Usuário não encontrado",
      });
    }

    const where = {
      userId,
    };

    if (req.query.repasseId) {
      where.repasseId = req.query.repasseId;
    }

    const returns = await Return.findAll({
      where,
      order: [["data", "ASC"]],
    });

    return res.json(returns);

  } catch (err) {
    console.error("GET RETURNS");
    console.error(err);

    return res.status(500).json({
      error: "Erro interno ao processar a solicitação.",
    });
  }
};

exports.create = async (req, res) => {

  try {

    const { id: userId } = req.params;

    const {
      data,
      percentual,
      variacao,
      rendimento,
      repasseId
    } = req.body;

    if (!data || percentual == null || variacao == null || rendimento == null) {
      return res.status(400).json({
        error: "Dados obrigatórios não informados.",
      });
    }

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        error: "Usuário não encontrado",
      });
    }

    // um lançamento por dia por cliente (editar/excluir dependem disso)
    const jaExiste = await Return.findOne({ where: { userId, data } });
    if (jaExiste) {
      return res.status(409).json({
        error: `Já existe um rendimento em ${dataBR(data)} para este cliente. Edite o lançamento existente.`,
      });
    }

    const novo = await Return.create({
      data,
      percentual,
      variacao,
      rendimento,
      repasseId: repasseId || null,
      userId,
    });

    await user.update({
      data_modificacao: new Date(),
    });

    return res.status(201).json({
      success: true,
      return: novo,
    });

  } catch (err) {

    console.error("CREATE RETURN");
    console.error(err);

    return res.status(500).json({
      error: "Erro interno ao processar a solicitação.",
    });

  }

};

exports.update = async (req, res) => {

  try {

    const { id: userId, ref } = req.params;

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        error: "Usuário não encontrado",
      });
    }

    const { rendimento, ambiguo } = await acharRendimento(userId, ref);

    if (ambiguo) {
      return res.status(409).json({
        error: "Há mais de um rendimento nesse dia. Atualize a página e tente de novo.",
      });
    }

    if (!rendimento) {
      return res.status(404).json({
        error: "Rendimento não encontrado",
      });
    }

    const {
      data,
      percentual,
      variacao,
      rendimento: valor,
      repasseId,
    } = req.body;

    const novosDados = {
      percentual,
      variacao,
      rendimento: valor,
      repasseId,
    };

    // troca de data: só para um dia válido que ainda não tenha lançamento
    if (data !== undefined && data !== rendimento.data) {
      if (!ISO_DATA.test(String(data))) {
        return res.status(400).json({ error: "Data inválida (use AAAA-MM-DD)." });
      }
      const ocupado = await Return.findOne({
        where: { userId, data, id: { [Op.ne]: rendimento.id } },
      });
      if (ocupado) {
        return res.status(409).json({
          error: `Já existe um rendimento em ${dataBR(data)} para este cliente.`,
        });
      }
      novosDados.data = data;
    }

    await rendimento.update(novosDados);

    await user.update({
      data_modificacao: new Date(),
    });

    return res.json({
      success: true,
      return: rendimento,
    });

  } catch (err) {

    console.error("UPDATE RETURN");
    console.error(err);

    return res.status(500).json({
      error: "Erro interno ao processar a solicitação.",
    });

  }

};

exports.remove = async (req, res) => {

  try {

    const { id: userId, ref } = req.params;

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        error: "Usuário não encontrado",
      });
    }

    const { rendimento, ambiguo } = await acharRendimento(userId, ref);

    if (ambiguo) {
      return res.status(409).json({
        error: "Há mais de um rendimento nesse dia. Atualize a página e tente de novo.",
      });
    }

    if (!rendimento) {
      return res.status(404).json({
        error: "Rendimento não encontrado",
      });
    }

    await rendimento.destroy();

    await user.update({
      data_modificacao: new Date(),
    });

    return res.json({
      success: true,
    });

  } catch (err) {

    console.error("DELETE RETURN");
    console.error(err);

    return res.status(500).json({
      error: "Erro interno ao processar a solicitação.",
    });

  }

};