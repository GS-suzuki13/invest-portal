const express = require("express");
const controller = require("../controllers/eventos.controller");
const { adminRequired } = require("../middlewares/auth");

const router = express.Router();

// Só o admin: os eventos citam clientes pelo nome (ex.: "Fechar 4º repasse — fulano")
router.get("/", adminRequired, controller.getAll);
router.get("/:id", adminRequired, controller.getById);
router.post("/", adminRequired, controller.create);
router.put("/:id", adminRequired, controller.update);
router.post("/:id/visto", adminRequired, controller.marcarVisto);
router.delete("/:id", adminRequired, controller.remove);

module.exports = router;