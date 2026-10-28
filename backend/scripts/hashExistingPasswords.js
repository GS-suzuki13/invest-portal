// Converte todas as senhas em texto puro para hash bcrypt.
// Seguro para rodar mais de uma vez: senhas já em hash são ignoradas.
// Uso: node scripts/hashExistingPasswords.js

const sequelize = require("../src/database");
const User = require("../models/User");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Conectado ao banco.");

    const users = await User.findAll();
    let convertidos = 0;

    for (const user of users) {
      if (User.isBcryptHash(user.password)) continue;

      // Marca o campo como alterado para o hook beforeUpdate gerar o hash
      user.password = user.password;
      user.changed("password", true);
      await user.save();

      convertidos++;
      console.log(`🔒 Senha convertida: ${user.user}`);
    }

    console.log(`✅ Concluído. ${convertidos} de ${users.length} senha(s) convertida(s).`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao converter senhas:", error);
    process.exit(1);
  }
})();
