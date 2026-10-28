// Carrega o .env que fica ao lado deste arquivo, independentemente de qual
// pasta o processo foi iniciado (alguns painéis de hospedagem usam outro cwd).
require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const app = require("./src/app");

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
