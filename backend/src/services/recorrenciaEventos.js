const { Op } = require("sequelize");
const sequelize = require("../database");
const Evento = require("../../models/Evento");

// Recorrência mensal de eventos.
//
// Cada mês é um Evento próprio (status/histórico independentes). Só a
// ocorrência MAIS RECENTE da série fica com recorrente=true. Quando ela é
// concluída/cancelada ou a data dela passa, criamos a do mês seguinte e
// "passamos o bastão" (a antiga fica recorrente=false). Meses que ficaram para
// trás também são criados (pendentes), para nenhum lembrete se perder.
// Para encerrar a série: desmarcar "recorrente" no evento mais recente.

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RODADAS = 36; // teto de meses gerados de uma vez (evento muito antigo)

// Data de hoje no fuso de Brasília, em YYYY-MM-DD (o servidor pode estar em UTC)
function hojeBrasil() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

// Mesmo dia no mês seguinte; se o mês não tiver esse dia (ex.: 31), usa o último.
// diaOriginal: dia da série (31/01 → 28/02 → 31/03, sem "escorregar").
function proximoMes(iso, diaOriginal) {
  const [ano, mes, diaData] = iso.split("-").map(Number);
  const dia = diaOriginal || diaData;
  const alvoAno = mes === 12 ? ano + 1 : ano;
  const alvoMes = mes === 12 ? 1 : mes + 1;
  const ultimoDia = new Date(Date.UTC(alvoAno, alvoMes, 0)).getUTCDate();
  const d = Math.min(dia, ultimoDia);
  return `${alvoAno}-${String(alvoMes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

async function gerarRecorrencias() {
  for (let rodada = 0; rodada < MAX_RODADAS; rodada++) {
    const hoje = hojeBrasil();
    const vencidos = (
      await Evento.findAll({
        where: {
          recorrente: true,
          [Op.or]: [{ status: { [Op.ne]: "pendente" } }, { data: { [Op.lt]: hoje } }],
        },
      })
    ).filter((e) => DATA_ISO.test(e.data));

    if (vencidos.length === 0) return;

    for (const evento of vencidos) {
      await sequelize.transaction(async (transaction) => {
        // update condicional: se outra requisição já passou o bastão, não duplica
        const [alterados] = await Evento.update(
          { recorrente: false },
          { where: { id: evento.id, recorrente: true }, transaction }
        );
        if (alterados !== 1) return;

        const diaOriginal = evento.dia_recorrencia || Number(evento.data.slice(8, 10));
        const data = proximoMes(evento.data, diaOriginal);
        // marcaram "recorrente" num evento antigo cuja ocorrência seguinte já existe
        const jaExiste = await Evento.count({ where: { nome: evento.nome, data }, transaction });
        if (jaExiste) return;

        await Evento.create(
          {
            nome: evento.nome,
            data,
            status: "pendente",
            recorrente: true,
            categoria: evento.categoria,
            observacao: evento.observacao,
            dia_recorrencia: diaOriginal,
          },
          { transaction }
        );
      });
    }
  }
}

// Nunca deixa a listagem/contagem falhar por causa da recorrência
async function gerarRecorrenciasSemFalhar() {
  try {
    await gerarRecorrencias();
  } catch (err) {
    console.error("[eventos.recorrencia] erro:", err);
  }
}

// iso + n dias (YYYY-MM-DD)
function somarDias(iso, n) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

module.exports = { gerarRecorrencias: gerarRecorrenciasSemFalhar, proximoMes, hojeBrasil, somarDias };
