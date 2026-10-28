const { DataTypes } = require("sequelize");
const sequelize = require("../src/database");
const User = require("./User");

const Repasse = sequelize.define("Repasse", {
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true 
  },
  userId: { 
    type: DataTypes.STRING, 
    allowNull: false,
    references: {
      model: User,
      key: "id",
    },
    onDelete: "CASCADE",
  },
  numero: {             // Ex: 1º Repasse, 2º Repasse...
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  dataInicio: {
    type: DataTypes.STRING, // Data inicial do período de rendimento
    allowNull: false,
  },
  dataFim: {
    type: DataTypes.STRING, // Data final do período de rendimento
    allowNull: false,
  },
  // Rendimento líquido já reinvestido no valor_aportado do investidor
  // (evita reinvestir duas vezes o mesmo repasse).
  reinvestido: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
});

User.hasMany(Repasse, { foreignKey: "userId", onDelete: "CASCADE" });
Repasse.belongsTo(User, { foreignKey: "userId" });

module.exports = Repasse;
