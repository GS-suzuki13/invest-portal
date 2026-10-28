const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

const sequelize = require("./database");
const ensureSchema = require("./ensureSchema");

const usersRoutes = require("./routes/users.routes");
const importRoutes = require("./routes/import.routes");
const returnsRoutes = require("./routes/returns.routes");
const repasseRoutes = require("./routes/repasse.routes");
const eventosRoutes = require("./routes/eventos.routes");
const indicesRoutes = require("./routes/indices.routes");
const chatRoutes = require("./routes/chat.routes");
const aportesRoutes = require("./routes/aportes.routes");
const saquesRoutes = require("./routes/saques.routes");

if (!process.env.JWT_SECRET) {
  console.error(
    "⚠️  JWT_SECRET não configurado — login e rotas autenticadas responderão 500 até definir a variável."
  );
}

const app = express();

// Necessário para o rate limit enxergar o IP real atrás de um proxy (Render, Nginx, etc.)
app.set("trust proxy", 1);

// FRONTEND_DIST: pasta com o build do frontend. Quando definida, o mesmo
// processo serve o site em "/" e a API em "/api" (deploy de um serviço só).
const FRONTEND_DIST = process.env.FRONTEND_DIST
  ? path.resolve(process.env.FRONTEND_DIST)
  : null;

// API consumida pelo frontend em outra origem: libera o Cross-Origin-Resource-Policy
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: FRONTEND_DIST
      ? {
          directives: {
            // index.html tem um script inline (quebra-loop de navegação)
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
            imgSrc: ["'self'", "data:", "blob:"],
          },
        }
      : undefined,
  })
);

// O site chama a API em /api (mesmo domínio, aqui ou na Vercel): tira o
// prefixo antes das rotas. Chamadas diretas sem o prefixo continuam valendo.
app.use((req, res, next) => {
  if (req.url === "/api" || req.url.startsWith("/api/") || req.url.startsWith("/api?")) {
    req.url = req.url.slice(4) || "/";
    if (req.url.startsWith("?")) req.url = "/" + req.url;
    req.isApi = true;
  }
  next();
});

// CORS: restrito quando FRONTEND_URL está definido; senão mantém aberto (comportamento atual)
const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors(
    allowedOrigins.length
      ? {
          origin(origin, cb) {
            // Sem cabeçalho de origem (curl, apps mobile) ou origem na lista: libera.
            // Caso contrário, apenas não envia os cabeçalhos de CORS (o navegador bloqueia).
            cb(null, !origin || allowedOrigins.includes(origin));
          },
        }
      : undefined
  )
);

app.use(express.json());

// Rotas
app.use("/users", usersRoutes);
app.use("/returns", returnsRoutes);
app.use("/returns/import", importRoutes);
app.use("/repasse", repasseRoutes);
app.use("/eventos", eventosRoutes);
app.use("/indices", indicesRoutes);
app.use("/chat", chatRoutes);
app.use("/aportes", aportesRoutes);
app.use("/saques", saquesRoutes);

// Rota simples para verificar se a API está funcionando
app.get("/", (req, res, next) => {
  if (FRONTEND_DIST && !req.isApi) return next();
  res.json({
    status: "ok",
    message: "API InvestPortal funcionando",
  });
});

// Diagnóstico de configuração: mostra apenas se cada variável ESTÁ presente
// (nunca o valor). Use para confirmar que o .env foi carregado no servidor.
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    node_env: process.env.NODE_ENV || null,
    config: {
      JWT_SECRET: Boolean(process.env.JWT_SECRET),
      DB_HOST: Boolean(process.env.DB_HOST),
      DB_NAME: Boolean(process.env.DB_NAME),
      FRONTEND_URL: Boolean(process.env.FRONTEND_URL),
    },
  });
});

// Site (SPA): arquivos do build e, para qualquer outra rota GET, o index.html
if (FRONTEND_DIST) {
  app.use(express.static(FRONTEND_DIST, { index: false, maxAge: "1y", immutable: true }));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.isApi) return next();
    res.set("Cache-Control", "no-store");
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
}

// Inicialização do banco
async function initializeDatabase() {
  try {
    console.log("🔄 Conectando ao banco de dados...");

    await sequelize.authenticate();

    console.log("✅ Conexão com o banco estabelecida!");

    await sequelize.sync({ alter: false });

    console.log("✅ Banco sincronizado!");

    await ensureSchema();
  } catch (error) {
    console.error("❌ Falha ao conectar/sincronizar o banco:");

    console.error(error);

    process.exit(1);
  }
}

// Testes de integração inicializam o banco por conta própria (SQLite em memória
// ou arquivo temporário) e ligam o servidor manualmente.
if (process.env.SKIP_DB_INIT !== "true") {
  initializeDatabase();
}

module.exports = app;
module.exports.initializeDatabase = initializeDatabase;
module.exports.sequelize = sequelize;