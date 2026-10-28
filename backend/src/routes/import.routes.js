const express = require("express");
const router = express.Router();
const multer = require("multer");
const { UPLOAD_DIR } = require("../utils/fileManager");
const { importReturns } = require("../controllers/import.controller");
const { adminRequired } = require("../middlewares/auth");

// Configuração do Multer
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (/\.csv$/i.test(file.originalname)) return cb(null, true);
    cb(new Error("Apenas arquivos .csv são permitidos"));
  },
});

// Erro do upload (tipo ou tamanho) vira 400 com mensagem, não página de erro
function receberArquivo(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();
    const msg = err.code === "LIMIT_FILE_SIZE" ? "Arquivo maior que 5 MB" : err.message;
    return res.status(400).json({ error: msg || "Arquivo inválido" });
  });
}

// Rota de importação
router.post("/:id", adminRequired, receberArquivo, importReturns);

module.exports = router;
