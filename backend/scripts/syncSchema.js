// Cria as tabelas no banco apontado pelo .env a partir dos models.
// Uso local (NUNCA rode apontando para o banco de produção):
//   node scripts/syncSchema.js
// Aceita --force para recriar tudo do zero (apaga os dados).

require("dotenv").config();
const sequelize = require("../src/database");

// A ordem importa por causa das foreign keys
require("../models/User");
require("../models/Repasse");
require("../models/Return");
require("../models/Evento");
require("../models/Message");
require("../models/Aporte");
require("../models/Saque");

const force = process.argv.includes("--force");

(async () => {
  try {
    await sequelize.authenticate();
    console.log(`✅ Conectado (${process.env.DB_DIALECT || "mysql"})`);

    if (process.env.NODE_ENV === "production") {
      console.error("❌ NODE_ENV=production — abortando por segurança.");
      process.exit(1);
    }

    await sequelize.sync({ force });
    console.log(force ? "✅ Schema recriado do zero." : "✅ Schema sincronizado.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Erro ao sincronizar schema:", err.message);
    process.exit(1);
  }
})();
