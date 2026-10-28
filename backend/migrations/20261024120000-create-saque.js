'use strict';

// Cria a tabela Saque (saques registrados manualmente pelo admin).
// Não altera nenhuma tabela existente.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Saque', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: { model: 'User', key: 'id' },
        onDelete: 'CASCADE',
      },
      valor: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      data_saque: { type: Sequelize.DATEONLY, allowNull: false },
      observacao: { type: Sequelize.STRING(500), allowNull: true },
      descontado_do_aportado: { type: Sequelize.BOOLEAN, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Saque');
  },
};
