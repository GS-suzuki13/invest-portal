'use strict';

// Adiciona ao Evento:
// - notificacao_vista_em: quando o admin clicou no aviso do sino (null = não viu)
// - dia_recorrencia: dia do mês original da série recorrente (evita 31 → 28 → 28)
// Colunas novas e opcionais; não altera dados existentes.
module.exports = {
  async up(queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('Evento');
    if (!desc.notificacao_vista_em) {
      await queryInterface.addColumn('Evento', 'notificacao_vista_em', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!desc.dia_recorrencia) {
      await queryInterface.addColumn('Evento', 'dia_recorrencia', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const desc = await queryInterface.describeTable('Evento');
    if (desc.notificacao_vista_em) await queryInterface.removeColumn('Evento', 'notificacao_vista_em');
    if (desc.dia_recorrencia) await queryInterface.removeColumn('Evento', 'dia_recorrencia');
  },
};
