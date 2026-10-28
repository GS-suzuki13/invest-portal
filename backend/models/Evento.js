const { DataTypes } = require("sequelize");
const sequelize = require("../src/database");

const Evento = sequelize.define("Evento", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },

  nome: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  data: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  status: {
    type: DataTypes.ENUM(
      "pendente",
      "concluido",
      "cancelado"
    ),
    defaultValue: "pendente",
  },

  recorrente: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },

  categoria: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  observacao: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  // Quando o admin clicou no aviso do sino (null = ainda não viu)
  notificacao_vista_em: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  // Dia do mês original da série recorrente (ex.: 31), para não "escorregar"
  // depois de meses curtos. null = usa o dia da própria data.
  dia_recorrencia: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
});

module.exports = Evento;