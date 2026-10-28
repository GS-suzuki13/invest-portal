const fs = require("fs");
const readline = require("readline");
const User = require("../models/User");
const Return = require("../models/Return");

// Funções auxiliares
function parseDateBRtoISO(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const m = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const [, dia, mes, ano] = m;
  return `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

function cleanString(s = "") {
  return String(s).trim().replace(/^"(.+)"$/, "$1");
}

function splitCSVLine(line) {
  const cols = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      cols.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  cols.push(cur);
  return cols;
}

function parsePercent(raw) {
  if (!raw) return null;
  const s = cleanString(raw).replace("%", "").trim();
  if (!s) return null;
  const normalized = s.replace(/\./g, "").replace(",", ".").trim();
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function parseMoney(raw) {
  if (!raw) return null;
  const s = cleanString(raw).replace("R$", "").trim();
  if (!s) return null;
  const normalized = s.replace(/\./g, "").replace(",", ".").trim();
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lê o CSV de histórico e insere os lançamentos do cliente.
 *
 * A leitura das linhas é síncrona (parsing puro); a escrita no banco acontece
 * só DEPOIS de todo o arquivo ser lido, num único `bulkCreate` aguardado —
 * assim a resposta HTTP só volta quando os dados realmente entraram e o
 * arquivo temporário só é apagado no fim.
 */
async function conversor(filePath, clientUser) {
  const user = await User.findByPk(clientUser);
  if (!user) throw new Error(`Usuário ${clientUser} não encontrado`);

  const rows = await new Promise((resolve, reject) => {
    const parsed = [];
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity,
    });

    rl.on("line", (rawLine) => {
      const line = rawLine.replace(/\r/g, "");
      if (!line.trim()) return;
      if (/Dashboard|Historico|Data,Dia,Percentual|Aporte Inicial/i.test(line)) return;
      if (/OUTUBRO|NOVEMBRO|JANEIRO|FEVEREIRO|MARÇO/i.test(line)) return;

      const parts = splitCSVLine(line);
      const dateIdx = parts.findIndex((p) => /\d{2}\/\d{2}\/\d{4}/.test(p));
      if (dateIdx === -1) return;

      const dataISO = parseDateBRtoISO(parts[dateIdx]);
      const percentual = parsePercent(parts[dateIdx + 2] ?? "");
      const variacao = parsePercent(parts[dateIdx + 3] ?? "");
      const rendimento = parseMoney(parts[dateIdx + 4] ?? "");

      if (!dataISO || (percentual === null && variacao === null && rendimento === null)) {
        return;
      }

      parsed.push({
        data: dataISO,
        percentual: percentual ?? 0,
        variacao: variacao ?? 0,
        rendimento: rendimento ?? 0,
        userId: user.id,
      });
    });

    rl.on("close", () => resolve(parsed));
    rl.on("error", reject);
  });

  // um lançamento por dia: pula datas que já existem no banco ou se repetem no arquivo
  const existentes = await Return.findAll({ where: { userId: user.id }, attributes: ["data"] });
  const datasUsadas = new Set(existentes.map((r) => r.data));
  const novos = rows.filter((r) => {
    if (datasUsadas.has(r.data)) return false;
    datasUsadas.add(r.data);
    return true;
  });

  let inseridos = 0;
  if (novos.length) {
    const criados = await Return.bulkCreate(novos, { validate: true });
    inseridos = criados.length;
    await user.update({ data_modificacao: new Date() });
  }

  return {
    success: true,
    message: "Importação concluída",
    inseridos,
    ignorados: rows.length - novos.length,
    data: novos,
  };
}

module.exports = conversor;
