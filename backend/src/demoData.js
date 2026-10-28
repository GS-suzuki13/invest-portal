/**
 * Dados fictícios da demonstração:
 *   admin           / admin123  — administrador
 *   cliente.teste   / 123456    — investidor sem histórico
 *   investidor.demo / demo123   — aporte de R$ 50.000, ~5 meses de rendimentos,
 *                                 3 repasses fechados, conversa no chat e um evento
 *
 * IDs fixos: o token emitido por uma instância continua válido em outra
 * (na Vercel cada instância serverless tem o próprio SQLite em /tmp).
 */

const sequelize = require("./database");
const ensureSchema = require("./ensureSchema");
const User = require("../models/User");
const Return = require("../models/Return");
const Repasse = require("../models/Repasse");
const Message = require("../models/Message");
const Evento = require("../models/Evento");
const { fecharRepasse } = require("./controllers/repasse.controller");

const USUARIOS_BASE = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    user: "admin",
    password: "admin123",
    token: "adm",
    name: "Admin Demonstração",
    cpf: "00000000191",
    email: "admin@demo.test",
    data_cadastro: "2025-01-01",
    valor_aportado: 0,
    percentual_contrato: 3,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    user: "cliente.teste",
    password: "123456",
    token: "user",
    name: "Cliente Teste",
    cpf: "11144477735",
    email: "cliente@demo.test",
    data_cadastro: "2025-02-01",
    valor_aportado: 10000,
    percentual_contrato: 3,
  },
];

const ID_INVESTIDOR_DEMO = "00000000-0000-4000-8000-000000000003";
const APORTE = 50000;
const DIAS_CORRIDOS_ATRAS = 150; // ~5 meses

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

/**
 * Cria (ou recria) os dados da demonstração.
 * zerar=true apaga o banco inteiro antes; senão só refaz o histórico do investidor.demo.
 */
async function popularDemo({ zerar = false } = {}) {
  await sequelize.authenticate();
  await sequelize.sync({ force: zerar });
  await ensureSchema();

  for (const u of USUARIOS_BASE) {
    await User.findOrCreate({ where: { user: u.user }, defaults: u });
  }

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
      id: ID_INVESTIDOR_DEMO,
      user: "investidor.demo",
      password: "demo123",
      token: "user",
      name: "Investidor Demonstração",
      cpf: "39053344705",
      email: "investidor.demo@demo.test",
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
      repasses.push(await fecharRepasse(demo.id));
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

  return {
    cadastro: iso(cadastro),
    ontem: iso(ontem),
    lancamentos: linhas.length,
    bruto: linhas.reduce((s, l) => s + l.rendimento, 0),
    repasses: repasses.length,
    mensagens: conversa.length,
  };
}

module.exports = { popularDemo, USUARIOS_BASE, APORTE };
