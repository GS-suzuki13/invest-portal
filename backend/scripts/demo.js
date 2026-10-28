/**
 * Sobe a DEMONSTRAÇÃO num processo só: SQLite descartável, dados fictícios
 * recriados a cada boot e o frontend (build) servido em "/" com a API em "/api".
 *
 *   cd frontend && npm run build
 *   cd ../backend && npm run demo
 *
 * Variáveis opcionais: PORT, JWT_SECRET, DB_STORAGE, FRONTEND_DIST.
 * Credenciais da demo: admin/admin123, investidor.demo/demo123, cliente.teste/123456
 */

const path = require("path");
const fs = require("fs");

process.env.DB_STORAGE =
  process.env.DB_STORAGE || path.join(__dirname, "..", "data", "demo.sqlite");
process.env.FRONTEND_DIST =
  process.env.FRONTEND_DIST || path.join(__dirname, "..", "..", "frontend", "dist");

if (!fs.existsSync(path.join(process.env.FRONTEND_DIST, "index.html"))) {
  console.error(`❌ build do frontend não encontrado em ${process.env.FRONTEND_DIST}`);
  process.exit(1);
}

require("./_localEnv");
const { popularDemo } = require("../src/demoData");

// banco zerado a cada boot: a demo sempre começa no mesmo estado
popularDemo({ zerar: true })
  .then(() => require("./devLocal"))
  .catch((err) => {
    console.error("\n💥 erro ao preparar a demo:\n", err);
    process.exit(1);
  });
