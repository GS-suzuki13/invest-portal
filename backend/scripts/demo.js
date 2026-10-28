/**
 * Sobe a DEMONSTRAÇÃO pública: SQLite descartável, dados fictícios recriados a
 * cada boot e o frontend (build) servido pelo mesmo processo.
 *
 *   cd frontend && npm run build
 *   cd ../backend && npm run demo
 *
 * Variáveis opcionais: PORT, JWT_SECRET, DB_STORAGE, FRONTEND_DIST.
 * Credenciais da demo: admin/admin123, investidor.demo/demo123, cliente.teste/123456
 */

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

process.env.DB_STORAGE =
  process.env.DB_STORAGE || path.join(__dirname, "..", "data", "demo.sqlite");
// segredo novo a cada boot se não vier do ambiente: sessões antigas caem junto com os dados
process.env.JWT_SECRET =
  process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
process.env.FRONTEND_DIST =
  process.env.FRONTEND_DIST || path.join(__dirname, "..", "..", "frontend", "dist");

if (!fs.existsSync(path.join(process.env.FRONTEND_DIST, "index.html"))) {
  console.error(`❌ build do frontend não encontrado em ${process.env.FRONTEND_DIST}`);
  process.exit(1);
}

// banco zerado a cada boot: a demo sempre começa no mesmo estado
fs.rmSync(process.env.DB_STORAGE, { force: true });
execFileSync(process.execPath, [path.join(__dirname, "seedDemo.js")], {
  stdio: "inherit",
  env: process.env,
});

require("./devLocal");
