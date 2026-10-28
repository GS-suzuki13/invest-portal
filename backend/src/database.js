const path = require("path");

// .env ao lado da raiz do backend (não depende do cwd do processo)
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const fs = require("fs");
const net = require("net");
const { Sequelize } = require("sequelize");

const dialect = process.env.DB_DIALECT || "mysql";

const commonDefine = {
  freezeTableName: true,
  timestamps: false,
};

let sequelize;

if (dialect === "sqlite") {
  // Somente para desenvolvimento/testes locais. Ativado com DB_DIALECT=sqlite.
  const storage = process.env.DB_STORAGE
    ? path.resolve(process.env.DB_STORAGE)
    : path.join(__dirname, "../data/local.sqlite");

  fs.mkdirSync(path.dirname(storage), { recursive: true });

  console.log("========== DATABASE CONFIG ==========");
  console.log("DIALECT: sqlite (local)");
  console.log("STORAGE:", storage);
  console.log("=====================================");

  sequelize = new Sequelize({
    dialect: "sqlite",
    storage,
    logging: false,
    define: commonDefine,
  });
} else {
  const host = process.env.DB_HOST;
  const port = Number(process.env.DB_PORT || 3306);

  // Diagnóstico de conexão apenas fora de produção (evita vazar host/usuário nos logs)
  if (process.env.NODE_ENV !== "production") {
    console.log("========== DATABASE CONFIG ==========");
    console.log("DB_HOST:", host);
    console.log("DB_PORT:", port);
    console.log("DB_NAME:", process.env.DB_NAME);
    console.log("DB_USER:", process.env.DB_USER);
    console.log("DB_PASSWORD:", process.env.DB_PASSWORD ? "CONFIGURADA" : "NÃO CONFIGURADA");
    console.log("=====================================");

    const socket = new net.Socket();

    socket.setTimeout(10000);

    socket.on("connect", () => {
      console.log(`✅ TCP OK: ${host}:${port}`);
      socket.destroy();
    });

    socket.on("timeout", () => {
      console.error(`❌ TCP TIMEOUT: ${host}:${port}`);
      socket.destroy();
    });

    socket.on("error", (err) => {
      console.error(`❌ TCP ERROR: ${host}:${port}`);
      console.error("Código:", err.code);
      console.error("Mensagem:", err.message);
    });

    socket.connect(port, host);
  }

  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host,
      port,
      dialect: "mysql",
      logging: false,

      define: commonDefine,

      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },

      connectTimeout: 30000,
    }
  );
}

module.exports = sequelize;
