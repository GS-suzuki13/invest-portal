const sequelize = require("./database");

/**
 * Garante colunas que foram adicionadas a models já existentes.
 *
 * `sequelize.sync({ alter: false })` cria TABELAS que faltam, mas não adiciona
 * COLUNAS a tabelas que já existem. Este guard roda no boot, é idempotente e
 * nunca derruba a inicialização (só loga).
 */
const COLUNAS = [
  {
    tabela: "User",
    coluna: "onboarding_versao",
    definicao: { type: sequelize.Sequelize.STRING, allowNull: true, defaultValue: null },
  },
  {
    tabela: "Repasse",
    coluna: "reinvestido",
    definicao: { type: sequelize.Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    tabela: "Evento",
    coluna: "notificacao_vista_em",
    definicao: { type: sequelize.Sequelize.DATE, allowNull: true },
  },
  {
    tabela: "Evento",
    coluna: "dia_recorrencia",
    definicao: { type: sequelize.Sequelize.INTEGER, allowNull: true },
  },
];

/**
 * Colunas que mudaram de TIPO. Só no MySQL: no SQLite o changeColumn recria a
 * tabela (e pode apagar em cascata o que depende dela); lá os números não têm
 * tipo fixo e o getter do model já resolve.
 */
const TIPOS = [
  {
    tabela: "User",
    coluna: "valor_aportado",
    // FLOAT/DOUBLE/REAL -> DECIMAL(15,2); valores existentes são arredondados para centavos
    precisaTrocar: (tipo) => /FLOAT|DOUBLE|REAL/i.test(tipo),
    definicao: { type: sequelize.Sequelize.DECIMAL(15, 2), allowNull: true, defaultValue: 0 },
  },
];

async function ensureSchema() {
  const qi = sequelize.getQueryInterface();

  if (sequelize.getDialect() === "mysql") {
    for (const { tabela, coluna, precisaTrocar, definicao } of TIPOS) {
      try {
        const desc = await qi.describeTable(tabela);
        if (desc[coluna] && precisaTrocar(desc[coluna].type)) {
          await qi.changeColumn(tabela, coluna, definicao);
          console.log(`🛠️  tipo alterado: ${tabela}.${coluna} (${desc[coluna].type} -> DECIMAL(15,2))`);
        }
      } catch (err) {
        console.warn(`⚠️  ensureSchema: não foi possível alterar o tipo de ${tabela}.${coluna} — ${err.message}`);
      }
    }
  }

  for (const { tabela, coluna, definicao } of COLUNAS) {
    try {
      const desc = await qi.describeTable(tabela);
      if (!desc[coluna]) {
        await qi.addColumn(tabela, coluna, definicao);
        console.log(`🛠️  coluna adicionada: ${tabela}.${coluna}`);
      }
    } catch (err) {
      console.warn(
        `⚠️  ensureSchema: não foi possível verificar ${tabela}.${coluna} — ${err.message}`
      );
    }
  }
}

module.exports = ensureSchema;
