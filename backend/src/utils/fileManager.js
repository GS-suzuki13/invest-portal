const path = require("path");

// Pasta dos arquivos temporários de upload (o multer cria se não existir)
const UPLOAD_DIR = path.join(__dirname, "../../uploads");

module.exports = { UPLOAD_DIR };
