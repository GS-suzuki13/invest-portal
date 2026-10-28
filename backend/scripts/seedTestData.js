// Cria dados de teste no banco local (um admin e um cliente).
// Uso local (NUNCA rode apontando para o banco de produção):
//   node scripts/seedTestData.js
//
// Credenciais criadas:
//   admin  / admin123   (token: adm)
//   cliente.teste / 123456   (token: user)

require("dotenv").config();
const sequelize = require("../src/database");
const User = require("../models/User");

(async () => {
  try {
    await sequelize.authenticate();

    if (process.env.NODE_ENV === "production") {
      console.error("❌ NODE_ENV=production — abortando por segurança.");
      process.exit(1);
    }

    await sequelize.sync();

    const [admin, adminCreated] = await User.findOrCreate({
      where: { user: "admin" },
      defaults: {
        user: "admin",
        password: "admin123",
        token: "adm",
        name: "Admin Teste",
        cpf: "00000000191",
        email: "admin@local.test",
        valor_aportado: 0,
        percentual_contrato: 3,
      },
    });
    console.log(adminCreated ? "✅ admin criado (admin / admin123)" : "ℹ️  admin já existe");

    const [cliente, clienteCreated] = await User.findOrCreate({
      where: { user: "cliente.teste" },
      defaults: {
        user: "cliente.teste",
        password: "123456",
        token: "user",
        name: "Cliente Teste",
        cpf: "11144477735",
        email: "cliente@local.test",
        valor_aportado: 10000,
        percentual_contrato: 3,
      },
    });
    console.log(clienteCreated ? "✅ cliente.teste criado (cliente.teste / 123456)" : "ℹ️  cliente.teste já existe");

    console.log(`\nID do cliente de teste: ${cliente.id}`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Erro ao criar dados de teste:", err.message);
    process.exit(1);
  }
})();
