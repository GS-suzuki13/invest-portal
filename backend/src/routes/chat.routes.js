const express = require("express");
const router = express.Router();
const controller = require("../controllers/chat.controller");
const { authRequired, adminRequired, selfOrAdmin } = require("../middlewares/auth");

// Rotas estáticas antes das com parâmetro (senão "resumo" cairia em :userId).
router.get("/resumo", authRequired, controller.resumo);
router.get("/conversas", adminRequired, controller.conversas);

// Conversa de um cliente: o próprio investidor ou o admin.
router.get("/:userId", selfOrAdmin("userId"), controller.mensagens);
router.post("/:userId", selfOrAdmin("userId"), controller.enviar);

module.exports = router;
