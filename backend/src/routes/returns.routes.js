const express = require("express");
const { getAll, create, update, remove } = require("../controllers/returns.controller");
const { adminRequired, selfOrAdmin } = require("../middlewares/auth");

const router = express.Router();

// CRUD de retornos
router.get('/:id', selfOrAdmin('id'), getAll);
router.post('/:id', adminRequired, create);
// :ref = id do lançamento (ou a data AAAA-MM-DD, formato antigo)
router.put('/:id/:ref', adminRequired, update);
router.delete('/:id/:ref', adminRequired, remove);

module.exports = router;
