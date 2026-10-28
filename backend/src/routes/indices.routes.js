const express = require("express");
const router = express.Router();
const controller = require("../controllers/indices.controller");
const { authRequired } = require("../middlewares/auth");

// Comparativo de rendimento (CDI e Tesouro Selic) — visível a qualquer usuário logado.
router.get("/comparativo", authRequired, controller.comparativo);

module.exports = router;
