const express = require("express");
const router = express.Router();
const { fecharRepasse, getRepasses, reinvestirRepasse, agendaRepasses } = require("../controllers/repasse.controller");
const { adminRequired, selfOrAdmin } = require("../middlewares/auth");

// Agenda: quem fecha hoje, atrasados e amanhã (antes de "/:userId")
router.get("/agenda", adminRequired, async (req, res) => {
  try {
    res.json(await agendaRepasses());
  } catch (err) {
    console.error("[repasse.agenda] erro:", err);
    res.status(500).json({ error: "Erro ao montar a agenda de repasses." });
  }
});

// Fechar repasse
router.post("/close/:userId", adminRequired, async (req, res) => {
  try {
    const repasse = await fecharRepasse(req.params.userId, req.body?.numero);

    // Formata para o front
    const formattedRepasse = {
      id: repasse.id,
      label: `${repasse.numero}º Repasse`,
      start: repasse.dataInicio,
      end: repasse.dataFim,
    };

    res.json(formattedRepasse); // Retorna direto

  } catch (err) {
    if (err.status === 409) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Erro interno ao processar o repasse." });
  }
});

// Reinveste o rendimento líquido de um repasse no valor aportado do
// investidor e avisa pelo chat do site.
router.post("/:userId/reinvestir", adminRequired, async (req, res) => {
  try {
    const { repasseId } = req.body || {};
    if (!repasseId) {
      return res.status(400).json({ error: "repasseId é obrigatório." });
    }

    const { user } = await reinvestirRepasse(req.params.userId, repasseId);
    const { password: _omit, ...safeUser } = user.toJSON();

    res.json({ success: true, user: safeUser });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    console.error("[repasse.reinvestir] erro:", err);
    res.status(500).json({ error: "Erro ao reinvestir rendimento." });
  }
});

// Listar repasses
router.get("/:userId", selfOrAdmin("userId"), async (req, res) => {
  try {
    const repasses = await getRepasses(req.params.userId);
    res.json({ success: true, repasses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno ao processar o repasse." });
  }
});

module.exports = router;
