const { DataTypes } = require("sequelize");
const sequelize = require("../src/database");
const User = require("./User");

// Saque (resgate) que o investidor pediu e a gestora pagou, registrado
// manualmente pelo admin. Espelho do Aporte. Sem edição/exclusão nesta versão.
const Saque = sequelize.define(
  "Saque",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: { model: User, key: "id" },
      onDelete: "CASCADE",
    },
    // DECIMAL: o MySQL devolve string ("1234.56") — converter ao serializar
    valor: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    data_saque: { type: DataTypes.DATEONLY, allowNull: false },
    observacao: { type: DataTypes.STRING(500), allowNull: true },
    // false = saque histórico, já descontado do valor_aportado quando foi
    // registrado (não subtraiu de novo)
    descontado_do_aportado: { type: DataTypes.BOOLEAN, allowNull: false },
  },
  {
    timestamps: true,
    updatedAt: false,
  }
);

User.hasMany(Saque, { foreignKey: "userId", onDelete: "CASCADE" });
Saque.belongsTo(User, { foreignKey: "userId" });

module.exports = Saque;
