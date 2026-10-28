const { DataTypes } = require("sequelize");
const sequelize = require("../src/database");
const User = require("./User");
const Repasse = require("./Repasse");

const Return = sequelize.define("Return", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  data: { type: DataTypes.STRING, allowNull: false },
  percentual: { type: DataTypes.FLOAT, allowNull: false },
  variacao: { type: DataTypes.FLOAT, allowNull: false },
  rendimento: { type: DataTypes.FLOAT, allowNull: false },
  repasseId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Repasse,
      key: "id",
    },
    onDelete: "SET NULL",
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
});

// Relações
User.hasMany(Return, { foreignKey: "userId", onDelete: "CASCADE" });
Return.belongsTo(User, { foreignKey: "userId" });

Repasse.hasMany(Return, { foreignKey: "repasseId", onDelete: "SET NULL" });
Return.belongsTo(Repasse, { foreignKey: "repasseId" });

module.exports = Return;
