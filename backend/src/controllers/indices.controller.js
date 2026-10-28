const { comparativo } = require("../services/indices");
const { hojeBrasil } = require("../services/recorrenciaEventos");

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const hojeIso = hojeBrasil;

// GET /indices/comparativo?inicio=YYYY-MM-DD&fim=YYYY-MM-DD
exports.comparativo = async (req, res) => {
  try {
    const { inicio, fim } = req.query;

    if (!ISO.test(inicio || "") || !ISO.test(fim || "")) {
      return res.status(400).json({
        error: "Informe inicio e fim no formato YYYY-MM-DD",
      });
    }

    // BCB só publica até o dia anterior; não adianta pedir datas futuras.
    const fimEfetivo = fim > hojeIso() ? hojeIso() : fim;

    if (inicio > fimEfetivo) {
      return res
        .status(400)
        .json({ error: "inicio precisa ser anterior a fim" });
    }

    // janela máxima de ~3 anos (proteção contra requisições enormes ao BCB)
    const limite = new Date(inicio);
    limite.setFullYear(limite.getFullYear() + 3);
    if (fimEfetivo > limite.toISOString().slice(0, 10)) {
      return res.status(400).json({ error: "Período máximo: 3 anos" });
    }

    const dados = await comparativo(inicio, fimEfetivo);
    res.json(dados);
  } catch (err) {
    console.error("[indices.comparativo] erro:", err.message);
    // o motivo técnico fica só no log do servidor
    res.status(502).json({ error: "Não foi possível obter os índices agora" });
  }
};
