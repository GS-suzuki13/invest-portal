const express = require("express");
const router = express.Router();
const controller = require("../controllers/saques.controller");
const { adminRequired } = require("../middlewares/auth");

router.post("/", adminRequired, controller.criar);
router.get("/", adminRequired, controller.listar);

module.exports = router;
