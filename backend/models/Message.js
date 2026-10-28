const { DataTypes } = require("sequelize");
const sequelize = require("../src/database");
const User = require("./User");

// Chat 1:1 entre cada cliente e o administrador.
// `userId` identifica a conversa (sempre o cliente). `autor` diz quem escreveu.
// `lida` = se o DESTINATÁRIO já leu (msg do cliente → lida quando o admin lê;
// msg do admin → lida quando o cliente lê).
const Message = sequelize.define(
  "Message",
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
    autor: {
      type: DataTypes.ENUM("cliente", "admin"),
      allowNull: false,
    },
    texto: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    lida: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    timestamps: true,
    updatedAt: false,
  }
);

User.hasMany(Message, { foreignKey: "userId", onDelete: "CASCADE" });
Message.belongsTo(User, { foreignKey: "userId" });

module.exports = Message;
