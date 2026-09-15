'use strict';

const TABLE = 'notificaciones';
const TIPO_CHECK = 'notificaciones_tipo_check';
const PRIVATE_MESSAGE_TYPE = 'mensagem_privada';

const PREVIOUS_TYPES = [
  'respuesta_interaccion',
  'agenda_task_created',
  'agenda_task_updated',
  'agenda_task_cancelled',
  'agenda_task_deleted',
];

const NEXT_TYPES = [
  ...PREVIOUS_TYPES,
  PRIVATE_MESSAGE_TYPE,
];

const buildTipoCheckSql = (queryInterface, tipos) => {
  const escaped = tipos.map((tipo) => queryInterface.sequelize.escape(tipo)).join(', ');
  return `tipo IN (${escaped})`;
};

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeConstraint(TABLE, TIPO_CHECK, { transaction });

      await queryInterface.addConstraint(TABLE, {
        fields: ['tipo'],
        type: 'check',
        name: TIPO_CHECK,
        where: Sequelize.literal(buildTipoCheckSql(queryInterface, NEXT_TYPES)),
        transaction,
      });
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [rows] = await queryInterface.sequelize.query(
        `SELECT count(*)::int AS total FROM ${TABLE} WHERE tipo = :tipo`,
        {
          replacements: { tipo: PRIVATE_MESSAGE_TYPE },
          transaction,
        }
      );
      const total = Number(rows?.[0]?.total) || 0;

      if (total > 0) {
        throw new Error(
          `Rollback bloqueado: existem ${total} notificaciones tipo ${PRIVATE_MESSAGE_TYPE}. `
          + 'Remoção automática de dados não é segura nesta migration.'
        );
      }

      await queryInterface.removeConstraint(TABLE, TIPO_CHECK, { transaction });

      await queryInterface.addConstraint(TABLE, {
        fields: ['tipo'],
        type: 'check',
        name: TIPO_CHECK,
        where: Sequelize.literal(buildTipoCheckSql(queryInterface, PREVIOUS_TYPES)),
        transaction,
      });
    });
  },
};
