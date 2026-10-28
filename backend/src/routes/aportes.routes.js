const express = require("express");
const router = express.Router();
const controller = require("../controllers/aportes.controller");
const { adminRequired, selfOrAdmin } = require("../middlewares/auth");

router.post("/", adminRequired, controller.criar);
router.get("/", adminRequired, controller.listar);
// Investidor vê só o próprio extrato (id do token = id da URL); admin vê qualquer um.
router.get("/extrato/:userId", selfOrAdmin("userId"), controller.extrato);

module.exports = router;
