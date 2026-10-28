'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('User', 'id', {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      allowNull: false,
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE User DROP PRIMARY KEY;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE User ADD PRIMARY KEY (id);
    `);

    await queryInterface.addConstraint('User', {
      fields: ['user'],
      type: 'unique',
      name: 'unique_user_constraint',
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Reverter: remover 'id' e restaurar 'user' como PK
    await queryInterface.removeConstraint('User', 'unique_user_constraint');
    await queryInterface.sequelize.query(`
      ALTER TABLE User DROP PRIMARY KEY;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE User ADD PRIMARY KEY (user);
    `);
    await queryInterface.removeColumn('User', 'id');
  }
};
