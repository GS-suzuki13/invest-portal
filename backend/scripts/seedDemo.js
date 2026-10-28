/**
 * Popula o banco LOCAL (SQLite) com os dados da demonstração
 * (ver src/demoData.js): admin, cliente.teste e o investidor.demo com
 * histórico suficiente para o comparativo CDI/Poupança aparecer preenchido.
 *
 *   cd backend
 *   npm run seed:demo
 *
 * NÃO toca em produção (força SQLite via _localEnv). É idempotente: reexecutar
 * apaga os rendimentos/repasses antigos do investidor.demo e gera de novo.
 */

require("./_localEnv");

const sequelize = require("../src/database");
const { popularDemo, APORTE } = require("../src/demoData");

const brl = (v) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

async function main() {
  const r = await popularDemo();

  console.log("\n✅ investidor.demo pronto");
  console.log(`   login:        investidor.demo / demo123`);
  console.log(`   aporte:       R$ ${APORTE.toLocaleString("pt-BR")}`);
  console.log(`   período:      ${r.cadastro} → ${r.ontem}`);
  console.log(`   rendimentos:  ${r.lancamentos} lançamentos (dias úteis)`);
  console.log(`   bruto:        R$ ${brl(r.bruto)}`);
  console.log(`   líquido (70%): R$ ${brl(r.bruto * 0.7)}`);
  console.log(`   repasses:     ${r.repasses} fechados`);
  console.log(`   chat:         ${r.mensagens} mensagens (1 não lida de cada lado)`);
  console.log(`   evento:       1 pendente (aparece no sino do admin)`);
  console.log(
    `\n   Suba a API (npm run local) e entre como investidor.demo para ver\n` +
      `   o comparativo com CDI e Poupança.\n`
  );

  await sequelize.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("\n💥 erro no seed:demo:\n", err);
  process.exit(1);
});
