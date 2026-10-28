const Evento = require("../../models/Evento");
const { pick } = require("../utils/pick");
const { gerarRecorrencias } = require("../services/recorrenciaEventos");

const EVENTO_FIELDS = ["nome", "data", "status", "recorrente", "categoria", "observacao"];

// GET todos os eventos
exports.getAll = async (req, res) => {
  try {
    await gerarRecorrencias();

    const eventos = await Evento.findAll({
      order: [["data", "ASC"]],
    });

    res.json(eventos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar eventos" });
  }
};

// GET evento por ID
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const evento = await Evento.findByPk(id);
    if (!evento) {
      return res.status(404).json({ error: "Evento não encontrado" });
    }

    res.json(evento);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar evento" });
  }
};

// POST novo evento
exports.create = async (req, res) => {
  try {
    const evento = await Evento.create(pick(req.body, EVENTO_FIELDS));
    await gerarRecorrencias(); // recorrente com data já passada: cria os meses seguintes

    res.json({ success: true, evento });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar evento" });
  }
};

// PUT editar evento
exports.update = async (req, res) => {
  try {
    const { id } = req.params;

    const evento = await Evento.findByPk(id);
    if (!evento) {
      return res.status(404).json({ error: "Evento não encontrado" });
    }

    const dados = pick(req.body, EVENTO_FIELDS);
    // data mudou: a série passa a seguir o novo dia e o aviso do sino volta
    if (dados.data && dados.data !== evento.data) {
      dados.dia_recorrencia = null;
      dados.notificacao_vista_em = null;
    }
    await evento.update(dados);
    await gerarRecorrencias(); // concluído/cancelado: cria a ocorrência do mês seguinte
    await evento.reload();

    res.json({ success: true, evento });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao editar evento" });
  }
};

// POST /eventos/:id/visto — admin clicou no aviso do sino; não aparece mais lá
exports.marcarVisto = async (req, res) => {
  try {
    const evento = await Evento.findByPk(req.params.id);
    if (!evento) {
      return res.status(404).json({ error: "Evento não encontrado" });
    }

    if (!evento.notificacao_vista_em) await evento.update({ notificacao_vista_em: new Date() });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao marcar aviso como visto" });
  }
};

// DELETE evento
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    const evento = await Evento.findByPk(id);
    if (!evento) {
      return res.status(404).json({ error: "Evento não encontrado" });
    }

    await evento.destroy();

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao excluir evento" });
  }
};