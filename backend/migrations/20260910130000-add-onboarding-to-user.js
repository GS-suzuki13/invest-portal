'use strict';

// Adiciona User.onboarding_versao (tutorial de onboarding do dashboard).
// Nullable, sem default — usuários existentes ficam com NULL e verão o tutorial
// uma vez.
module.exports = {
  async up(queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('User');
    if (!desc.onboarding_versao) {
      await queryInterface.addColumn('User', 'onboarding_versao', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface) {
    const desc = await queryInterface.describeTable('User');
    if (desc.onboarding_versao) {
      await queryInterface.removeColumn('User', 'onboarding_versao');
    }
  },
};
