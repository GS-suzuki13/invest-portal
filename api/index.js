// Função serverless da Vercel: a API inteira (Express) atende em /api/*.
// Cada instância sobe com um SQLite próprio em /tmp, já com os dados fictícios
// da demonstração (src/demoData.js). Os IDs fixos mantêm o login válido entre
// instâncias; o que for alterado some quando a instância é reciclada.

process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE = process.env.DB_STORAGE || "/tmp/invest-portal-demo.sqlite";
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR || "/tmp/uploads";
process.env.SKIP_DB_INIT = "true";
// Só para a demo: as credenciais de admin já são públicas, então um segredo
// conhecido não dá acesso a mais nada. Em produção defina JWT_SECRET no projeto.
process.env.JWT_SECRET = process.env.JWT_SECRET || "invest-portal-demo-secret";

const app = require("../backend/src/app");
const { popularDemo } = require("../backend/src/demoData");

let pronto = null;

module.exports = async (req, res) => {
  if (!pronto) {
    pronto = popularDemo({ zerar: true }).catch((err) => {
      pronto = null; // a próxima requisição tenta de novo
      throw err;
    });
  }

  try {
    await pronto;
  } catch (err) {
    console.error("[demo] falha ao preparar o banco:", err);
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Demonstração iniciando, tente de novo em instantes." }));
    return;
  }

  return app(req, res);
};
