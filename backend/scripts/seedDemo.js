/**
 * Popula o banco LOCAL (SQLite) com um investidor de demonstração que tem
 * histórico suficiente para o comparativo CDI/Poupança aparecer preenchido.
 *
 *   cd backend
 *   npm run seed:demo
 *
 * Cria/reinicia:
 *   investidor.demo / demo123   — aporte de R$ 50.000, ~5 meses de rendimentos
 *                                 e 3 repasses fechados.
 *
 * NÃO toca em produção (força SQLite via _localEnv). É idempotente: reexecutar
 * apaga os rendimentos/repasses antigos do investidor.demo e gera de novo.
 */

require("./_localEnv");

const sequelize = require("../src/database");
const ensureSchema = require("../src/ensureSchema");
const User = require("../models/User");
const Return = require("../models/Return");
const Repasse = require("../models/Repasse");
const Message = require("../models/Message");
const Evento = require("../models/Evento");
const { fecharRepasse } = require("../src/controllers/repasse.controller");

// PRNG determinístico — mesma "sorte" a cada execução
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (d) => d.toISOString().slice(0, 10);
const ehDiaUtil = (d) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6;

const APORTE = 50000;
const DIAS_CORRIDOS_ATRAS = 150; // ~5 meses

async function main() {
  await sequelize.authenticate();
  await sequelize.sync();
  await ensureSchema();

  const hoje = new Date();
  hoje.setUTCHours(0, 0, 0, 0);

  const cadastro = new Date(hoje);
  cadastro.setUTCDate(cadastro.getUTCDate() - DIAS_CORRIDOS_ATRAS);
  // começa numa segunda-feira
  while (cadastro.getUTCDay() !== 1)
    cadastro.setUTCDate(cadastro.getUTCDate() + 1);

  const [demo] = await User.findOrCreate({
    where: { user: "investidor.demo" },
    defaults: {
      user: "investidor.demo",
      password: "demo123",
      token: "user",
      name: "Investidor Demonstração",
      cpf: "39053344705",
      email: "investidor.demo@local.test",
      data_cadastro: iso(cadastro),
      valor_aportado: APORTE,
      percentual_contrato: 3,
    },
  });

  await demo.update({
    data_cadastro: iso(cadastro),
    valor_aportado: APORTE,
    percentual_contrato: 3,
  });

  // limpa histórico anterior deste investidor
  await Return.destroy({ where: { userId: demo.id } });
  await Repasse.destroy({ where: { userId: demo.id } });

  // gera rendimentos de cada dia útil do cadastro até ontem
  const rand = mulberry32(20260910);
  const ontem = new Date(hoje);
  ontem.setUTCDate(ontem.getUTCDate() - 1);

  const linhas = [];
  for (
    let d = new Date(cadastro);
    d <= ontem;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    if (!ehDiaUtil(d)) continue;

    // rendimento BRUTO do dia: ~0,08% a 0,17% (média ~0,115%), acima do CDI (~0,055%)
    const perc = 0.08 + rand() * 0.09;
    const variacao = (rand() - 0.45) * 0.6;
    const rendimento = Number(((APORTE * perc) / 100).toFixed(2));

    linhas.push({
      data: iso(d),
      percentual: Number(perc.toFixed(4)),
      variacao: Number(variacao.toFixed(4)),
      rendimento,
      userId: demo.id,
    });
  }

  await Return.bulkCreate(linhas);

  // fecha 3 repasses (30 dias úteis cada, a partir do cadastro) — mesmo fluxo
  // disparado por POST /repasse/close/:userId.
  const repasses = [];
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fecharRepasse(demo.id);
      repasses.push(r);
    } catch (err) {
      console.warn("  repasse não fechado:", err.message);
      break;
    }
  }

  // conversa de exemplo entre o investidor.demo e o admin
  await Message.destroy({ where: { userId: demo.id } });
  const t0 = hoje.getTime();
  const min = 60 * 1000;
  const conversa = [
    { autor: "cliente", texto: "Boa tarde! Quando cai o próximo repasse?", em: t0 - 180 * min, lida: true },
    { autor: "admin", texto: "Boa tarde! O 4º repasse fecha daqui a ~8 dias úteis, aviso por aqui.", em: t0 - 170 * min, lida: true },
    { autor: "cliente", texto: "Perfeito, obrigado! Consigo ver o histórico do mês?", em: t0 - 40 * min, lida: false },
    { autor: "admin", texto: "Sim! Está no seu portal, na tabela de rendimentos.", em: t0 - 15 * min, lida: false },
  ];
  await Message.bulkCreate(
    conversa.map((c) => ({
      userId: demo.id,
      autor: c.autor,
      texto: c.texto,
      lida: c.lida,
      createdAt: new Date(c.em),
    }))
  );

  // um evento pendente para o sino do admin ter o que mostrar
  await Evento.findOrCreate({
    where: { nome: "Fechar 4º repasse — investidor.demo" },
    defaults: {
      nome: "Fechar 4º repasse — investidor.demo",
      data: iso(hoje),
      status: "pendente",
      recorrente: false,
      categoria: "repasse",
    },
  });

  const bruto = linhas.reduce((s, l) => s + l.rendimento, 0);
  const liquido = bruto * 0.7;

  console.log("\n✅ investidor.demo pronto");
  console.log(`   login:        investidor.demo / demo123`);
  console.log(`   aporte:       R$ ${APORTE.toLocaleString("pt-BR")}`);
  console.log(`   período:      ${iso(cadastro)} → ${iso(ontem)}`);
  console.log(`   rendimentos:  ${linhas.length} lançamentos (dias úteis)`);
  console.log(
    `   bruto:        R$ ${bruto.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
    })}`
  );
  console.log(
    `   líquido (70%): R$ ${liquido.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
    })}`
  );
  console.log(`   repasses:     ${repasses.length} fechados`);
  console.log(`   chat:         ${conversa.length} mensagens (1 não lida de cada lado)`);
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
