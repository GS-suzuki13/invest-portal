const path = require("path");

// Pasta dos arquivos temporários de upload (o multer cria se não existir)
// UPLOAD_DIR: em ambiente serverless (Vercel) só /tmp aceita escrita
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "../../uploads");

module.exports = { UPLOAD_DIR };
