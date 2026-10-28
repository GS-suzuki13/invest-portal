'use strict';

// Cria a tabela Aporte (aportes registrados manualmente pelo admin).
// Não altera nenhuma tabela existente.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Aporte', {
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
      data_recebimento: { type: Sequelize.DATEONLY, allowNull: false },
      observacao: { type: Sequelize.STRING(500), allowNull: true },
      somado_ao_aportado: { type: Sequelize.BOOLEAN, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Aporte');
  },
};
