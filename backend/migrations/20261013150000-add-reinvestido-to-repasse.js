'use strict';

// Adiciona Repasse.reinvestido — marca se o rendimento líquido desse repasse já
// foi somado ao valor_aportado do investidor (evita reinvestir duas vezes).
module.exports = {
  async up(queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('Repasse');
    if (!desc.reinvestido) {
      await queryInterface.addColumn('Repasse', 'reinvestido', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  async down(queryInterface) {
    const desc = await queryInterface.describeTable('Repasse');
    if (desc.reinvestido) {
      await queryInterface.removeColumn('Repasse', 'reinvestido');
    }
  },
};
