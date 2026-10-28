const { DataTypes } = require("sequelize");
const bcrypt = require("bcrypt");
const sequelize = require("../src/database");

const User = sequelize.define("User", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  user: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  token: {
    type: DataTypes.ENUM("adm", "user"),
    allowNull: false,
    defaultValue: "user",
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  cpf: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  data_cadastro: {
    type: DataTypes.DATEONLY,
    defaultValue: DataTypes.NOW,
  },
  data_modificacao: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  // dinheiro em DECIMAL (FLOAT acumula erro de arredondamento). O MySQL devolve
  // DECIMAL como texto: o getter mantém número para a API e para as contas.
  valor_aportado: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
    get() {
      const v = this.getDataValue("valor_aportado");
      return v === null || v === undefined ? v : Number(v);
    },
  },
  percentual_contrato: {
    type: DataTypes.FLOAT,
    defaultValue: 3,
  },
  // Versão do tutorial de onboarding que o usuário concluiu/pulou.
  // null = nunca viu. Ver frontend ONBOARDING_VERSION.
  onboarding_versao: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null,
  },
});

const SALT_ROUNDS = 10;

function isBcryptHash(value) {
  return typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);
}

// Faz hash da senha ao criar, se ainda não estiver em hash
User.beforeCreate(async (user) => {
  if (user.password && !isBcryptHash(user.password)) {
    user.password = await bcrypt.hash(user.password, SALT_ROUNDS);
  }
});

// Faz hash ao atualizar, somente se a senha mudou
User.beforeUpdate(async (user) => {
  if (user.changed("password") && user.password && !isBcryptHash(user.password)) {
    user.password = await bcrypt.hash(user.password, SALT_ROUNDS);
  }
});

// Valida senha aceitando hash novo OU texto puro legado
User.prototype.validatePassword = async function (plain) {
  if (isBcryptHash(this.password)) {
    return bcrypt.compare(plain, this.password);
  }
  return this.password === plain; // usuário ainda não migrado
};

User.isBcryptHash = isBcryptHash;

module.exports = User;
