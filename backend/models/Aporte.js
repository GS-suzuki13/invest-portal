const { DataTypes } = require("sequelize");
const sequelize = require("../src/database");
const User = require("./User");

// Aporte que o investidor transferiu para a conta da gestora, registrado
// manualmente pelo admin. Sem edição/exclusão nesta versão.
const Aporte = sequelize.define(
  "Aporte",
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
    data_recebimento: { type: DataTypes.DATEONLY, allowNull: false },
    observacao: { type: DataTypes.STRING(500), allowNull: true },
    // false = aporte histórico, já incluso no valor_aportado quando foi
    // registrado (não somou de novo)
    somado_ao_aportado: { type: DataTypes.BOOLEAN, allowNull: false },
  },
  {
    timestamps: true,
    updatedAt: false,
  }
);

User.hasMany(Aporte, { foreignKey: "userId", onDelete: "CASCADE" });
Aporte.belongsTo(User, { foreignKey: "userId" });

module.exports = Aporte;
