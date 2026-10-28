'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('User', 'id', {
      type: Sequelize.UUID,
      allowNull: false,
      defaultValue: Sequelize.literal('(UUID())'),
      unique: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('User', 'id');
  }
};
