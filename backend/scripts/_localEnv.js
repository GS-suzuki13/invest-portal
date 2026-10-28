/**
 * Configura o ambiente LOCAL (SQLite + dev) e é `require`-ado ANTES de qualquer
 * módulo da app. Nunca toca no banco de produção: força DB_DIALECT=sqlite e
 * NODE_ENV=development, ignorando DB_* / NODE_ENV / JWT_SECRET do backend/.env.

 */

const path = require("path");

process.env.NODE_ENV = "development";
process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE =
  process.env.DB_STORAGE ||
  path.join(__dirname, "..", "data", "local.sqlite");
process.env.JWT_SECRET = process.env.JWT_SECRET || "dev-local-secret";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "";
process.env.PORT = process.env.PORT || "5000";
process.env.SKIP_DB_INIT = "true";

module.exports = {
  storage: process.env.DB_STORAGE,
};
