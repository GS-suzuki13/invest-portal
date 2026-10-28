const { Op } = require("sequelize");
const sequelize = require("../database");
const User = require("../../models/User");
const Return = require("../../models/Return");
const Repasse = require("../../models/Repasse");
const Message = require("../../models/Message");
const { montarMensagemReinvestimento } = require("../services/mensagemReinvestimento");

// Adiciona dias úteis. Conta em UTC (as datas chegam como "YYYY-MM-DD" =
// meia-noite UTC), para o resultado não depender do fuso do servidor.
function addDiasUteis(startDate, diasUteis) {
  const result = new Date(startDate);
  let addedDays = 0;
  while (addedDays < diasUteis) {
    result.setUTCDate(result.getUTCDate() + 1);
    const day = result.getUTCDay();
    if (day !== 0 && day !== 6) addedDays++; // Ignora sábados e domingos
  }
  return result;
}

// Período do próximo repasse do investidor: começa no fim do último repasse
// (ou no cadastro) e termina 30 dias úteis depois.
function periodoSeguinte(user, ultimoRepasse) {
  const dataInicio = ultimoRepasse
    ? new Date(ultimoRepasse.dataFim)
    : new Date(user.data_cadastro);

  if (isNaN(dataInicio.getTime())) {
    throw new Error(
      `Data inválida para dataInicio: ${
        ultimoRepasse ? ultimoRepasse.dataFim : user.data_cadastro
      }`
    );
  }

  return {
    numero: ultimoRepasse ? ultimoRepasse.numero + 1 : 1,
    dataInicio: dataInicio.toISOString().split("T")[0],
    dataFim: addDiasUteis(dataInicio, 30).toISOString().split("T")[0],
  };
}

// Fecha um repasse. numeroEsperado (opcional): se vier, só fecha se o próximo
// repasse for mesmo esse número — evita fechar duas vezes num clique duplo.
async function fecharRepasse(userId, numeroEsperado) {
  return sequelize.transaction(async (transaction) => {
    // trava o investidor: dois fechamentos simultâneos ficam em fila
    const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user) throw new Error("Usuário não encontrado");

    const ultimoRepasse = await Repasse.findOne({
      where: { userId },
      order: [["numero", "DESC"]],
      transaction,
    });

    const periodo = periodoSeguinte(user, ultimoRepasse);
    if (numeroEsperado != null && Number(numeroEsperado) !== periodo.numero) {
      const err = new Error(`O ${numeroEsperado}º repasse deste investidor já foi fechado.`);
      err.status = 409;
      throw err;
    }

    const repasse = await Repasse.create({ userId, ...periodo }, { transaction });

    await Return.update(
      { repasseId: repasse.id },
      {
        where: {
          userId,
          data: {
            [Op.between]: [periodo.dataInicio, periodo.dataFim],
          },
        },
        transaction,
      }
    );

    await user.update({ data_modificacao: new Date() }, { transaction });

    return repasse;
  });
}

// Data de hoje no fuso de Brasília (YYYY-MM-DD) e o dia útil seguinte
function hojeBrasil() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}
function proximoDiaUtil(iso) {
  return addDiasUteis(new Date(iso), 1).toISOString().split("T")[0];
}

// Agenda de repasses: investidores cujo próximo repasse vence hoje, já venceu
// sem ser fechado (atrasado) ou vence no próximo dia útil — com a prévia dos
// valores do período (mesma regra 70/30 do resto do sistema).
async function agendaRepasses() {
  const hoje = hojeBrasil();
  const amanha = proximoDiaUtil(hoje);

  const users = await User.findAll({
    where: { token: "user" },
    attributes: ["id", "name", "valor_aportado", "data_cadastro"],
  });

  const ultimos = new Map();
  for (const r of await Repasse.findAll({ attributes: ["userId", "numero", "dataFim"] })) {
    const atual = ultimos.get(r.userId);
    if (!atual || r.numero > atual.numero) ultimos.set(r.userId, r);
  }

  const itens = [];
  for (const user of users) {
    let periodo;
    try {
      periodo = periodoSeguinte(user, ultimos.get(user.id));
    } catch {
      continue; // cadastro sem data válida
    }
    if (periodo.dataFim > amanha) continue;
    itens.push({
      userId: user.id,
      nome: user.name,
      valor_aportado: Number(user.valor_aportado || 0),
      ...periodo,
      situacao: periodo.dataFim < hoje ? "atrasado" : periodo.dataFim === hoje ? "hoje" : "amanha",
    });
  }

  if (itens.length) {
    const lancamentos = await Return.findAll({
      where: { userId: itens.map((i) => i.userId) },
      attributes: ["userId", "data", "rendimento"],
    });
    for (const item of itens) {
      // os mesmos lançamentos que o fechamento vai associar ao repasse
      const doPeriodo = lancamentos.filter(
        (l) => l.userId === item.userId && l.data >= item.dataInicio && l.data <= item.dataFim
      );
      const bruto = doPeriodo.reduce((s, l) => s + Number(l.rendimento || 0), 0);
      item.lancamentos = doPeriodo.length;
      item.bruto = Math.round(bruto * 100) / 100;
      item.taxa = Math.round(bruto * 0.3 * 100) / 100;
      item.liquido = Math.round(bruto * 0.7 * 100) / 100;
    }
  }

  const ordem = { hoje: 0, atrasado: 1, amanha: 2 };
  itens.sort(
    (a, b) => ordem[a.situacao] - ordem[b.situacao] || a.dataFim.localeCompare(b.dataFim) || a.nome.localeCompare(b.nome)
  );

  return { hoje, amanha, itens };
}

// Reinveste o rendimento líquido de um repasse já fechado no valor_aportado
// do investidor, e avisa o investidor pelo chat do site. Reaproveita a mesma
// regra 70/30 do resto do sistema (soma Return.rendimento do repasse).
// Erro de regra de negócio: a mensagem pode ir para a tela (status 400)
const erroDeRegra = (msg) => Object.assign(new Error(msg), { status: 400 });

async function reinvestirRepasse(userId, repasseId) {
  const user = await User.findByPk(userId);
  if (!user) throw erroDeRegra("Usuário não encontrado");

  const repasse = await Repasse.findOne({ where: { id: repasseId, userId } });
  if (!repasse) throw erroDeRegra("Repasse não encontrado");
  if (repasse.reinvestido) throw erroDeRegra("Este repasse já foi reinvestido");

  const lancamentos = await Return.findAll({ where: { repasseId } });
  const valorBruto = lancamentos.reduce((soma, r) => soma + Number(r.rendimento || 0), 0);
  const valorLiquido = valorBruto * 0.7;

  const valorAnterior = Number(user.valor_aportado || 0);
  const valorAtual = valorAnterior + valorLiquido;

  await user.update({ valor_aportado: valorAtual, data_modificacao: new Date() });
  await repasse.update({ reinvestido: true });

  const texto = montarMensagemReinvestimento({
    nome: user.name,
    valorAnterior,
    valorBruto,
    valorLiquido,
    valorAtual,
  });

  const mensagem = await Message.create({
    userId,
    autor: "admin",
    texto,
    lida: false,
  });

  return { user, mensagem };
}

// Lista todos os repasses de um usuário
async function getRepasses(userId) {
  const repasses = await Repasse.findAll({
    where: { userId },
    order: [["numero", "ASC"]],
  });

  return repasses.map(r => ({
    id: r.id,
    label: `${r.numero}º Repasse`,
    start: r.dataInicio,
    end: r.dataFim,
  }));
}

module.exports = { fecharRepasse, getRepasses, reinvestirRepasse, agendaRepasses };
