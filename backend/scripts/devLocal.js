/**
 * Sobe o backend 100% LOCAL, com SQLite — nunca toca no banco de produção.
 *
 *   cd backend
 *   npm run local
 *
 * - Banco: arquivo SQLite em backend/data/local.sqlite (persiste entre execuções).
 * - Garante um admin e um cliente de teste.
 * - Para ver o comparativo CDI/Poupança com dados, rode antes:  npm run seed:demo
 *
 * Credenciais:
 *   admin           / admin123
 *   cliente.teste   / 123456
 *   investidor.demo / demo123      (criado pelo seed:demo, com histórico)
 */

require("./_localEnv");

const app = require("../src/app");
const sequelize = require("../src/database");
const ensureSchema = require("../src/ensureSchema");
const User = require("../models/User");
const { USUARIOS_BASE } = require("../src/demoData");


async function main() {
  await sequelize.authenticate();
  await sequelize.sync();
  await ensureSchema();
  console.log("✅ SQLite pronto:", process.env.DB_STORAGE);

  for (const s of USUARIOS_BASE) {
    const [u, criado] = await User.findOrCreate({
      where: { user: s.user },
      defaults: s,
    });
    console.log(
      `${criado ? "✅ criado" : "ℹ️  já existe"}: ${s.user}  (id ${u.id})`
    );
  }

  const demo = await User.findOne({ where: { user: "investidor.demo" } });
  if (!demo) {
    console.log(
      "\n💡 Rode  npm run seed:demo  para criar o investidor.demo com histórico\n" +
        "   e ver o comparativo CDI/Poupança preenchido."
    );
  }

  app.listen(process.env.PORT, () => {
    console.log(`\n🚀 Backend LOCAL:  http://localhost:${process.env.PORT}`);
    console.log("   admin           / admin123");
    console.log("   cliente.teste   / 123456");
    if (demo) console.log("   investidor.demo / demo123   (com histórico)");
    console.log("\n   Ctrl+C para parar.\n");
  });
}

main().catch((err) => {
  console.error("\n💥 erro ao subir o backend local:\n", err);
  process.exit(1);
});
