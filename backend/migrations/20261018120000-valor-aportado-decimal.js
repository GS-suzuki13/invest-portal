'use strict';

// User.valor_aportado: FLOAT -> DECIMAL(15,2) (dinheiro sem erro de ponto flutuante).
// Mesmo ajuste que o ensureSchema faz no boot; idempotente. Só MySQL (ver ensureSchema.js).
module.exports = {
  async up(queryInterface, Sequelize) {
    if (queryInterface.sequelize.getDialect() !== 'mysql') return;
    const desc = await queryInterface.describeTable('User');
    if (desc.valor_aportado && /FLOAT|DOUBLE|REAL/i.test(desc.valor_aportado.type)) {
      await queryInterface.changeColumn('User', 'valor_aportado', {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    if (queryInterface.sequelize.getDialect() !== 'mysql') return;
    await queryInterface.changeColumn('User', 'valor_aportado', {
      type: Sequelize.FLOAT,
      allowNull: true,
      defaultValue: 0,
    });
  },
};
