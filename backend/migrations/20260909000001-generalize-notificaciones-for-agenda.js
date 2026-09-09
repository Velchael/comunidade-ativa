'use strict';

const TABLE = 'notificaciones';
const TIPO_CHECK = 'notificaciones_tipo_check';

const TIPOS = [
  'respuesta_interaccion',
  'agenda_task_created',
  'agenda_task_updated',
  'agenda_task_cancelled',
  'agenda_task_deleted',
];

const AGENDA_TIPOS = TIPOS.filter((tipo) => tipo.startsWith('agenda_task_'));

const buildTipoCheckSql = (queryInterface) => {
  const escaped = TIPOS.map((tipo) => queryInterface.sequelize.escape(tipo)).join(', ');
  return `tipo IN (${escaped})`;
};

const buildAgendaTiposSql = (queryInterface) => (
  AGENDA_TIPOS.map((tipo) => queryInterface.sequelize.escape(tipo)).join(', ')
);

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeConstraint(TABLE, TIPO_CHECK, { transaction });

      await queryInterface.addColumn(TABLE, 'comunidad_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'comunidades',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      }, { transaction });

      await queryInterface.addColumn(TABLE, 'task_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn(TABLE, 'titulo', {
        type: Sequelize.STRING,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn(TABLE, 'corpo', {
        type: Sequelize.TEXT,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn(TABLE, 'url', {
        type: Sequelize.STRING,
        allowNull: true,
      }, { transaction });

      await queryInterface.changeColumn(TABLE, 'interaccion_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
      }, { transaction });

      await queryInterface.changeColumn(TABLE, 'respuesta_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
      }, { transaction });

      await queryInterface.addConstraint(TABLE, {
        fields: ['tipo'],
        type: 'check',
        name: TIPO_CHECK,
        where: Sequelize.literal(buildTipoCheckSql(queryInterface)),
        transaction,
      });

      await queryInterface.addConstraint(TABLE, {
        fields: ['tipo', 'interaccion_id', 'respuesta_id'],
        type: 'check',
        name: 'notificaciones_respuesta_interaccion_payload_check',
        where: Sequelize.literal(`
          tipo <> 'respuesta_interaccion'
          OR (interaccion_id IS NOT NULL AND respuesta_id IS NOT NULL)
        `),
        transaction,
      });

      await queryInterface.addConstraint(TABLE, {
        fields: ['tipo', 'comunidad_id', 'titulo', 'corpo', 'url'],
        type: 'check',
        name: 'notificaciones_agenda_payload_check',
        where: Sequelize.literal(`
          tipo NOT IN (${buildAgendaTiposSql(queryInterface)})
          OR (
            comunidad_id IS NOT NULL
            AND titulo IS NOT NULL
            AND corpo IS NOT NULL
            AND url IS NOT NULL
          )
        `),
        transaction,
      });
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        DELETE FROM ${TABLE}
        WHERE tipo IN (${buildAgendaTiposSql(queryInterface)})
      `, { transaction });

      await queryInterface.removeConstraint(
        TABLE,
        'notificaciones_agenda_payload_check',
        { transaction }
      );
      await queryInterface.removeConstraint(
        TABLE,
        'notificaciones_respuesta_interaccion_payload_check',
        { transaction }
      );
      await queryInterface.removeConstraint(TABLE, TIPO_CHECK, { transaction });

      await queryInterface.addConstraint(TABLE, {
        fields: ['tipo'],
        type: 'check',
        name: TIPO_CHECK,
        where: Sequelize.literal("tipo IN ('respuesta_interaccion')"),
        transaction,
      });

      await queryInterface.changeColumn(TABLE, 'interaccion_id', {
        type: Sequelize.INTEGER,
        allowNull: false,
      }, { transaction });

      await queryInterface.changeColumn(TABLE, 'respuesta_id', {
        type: Sequelize.INTEGER,
        allowNull: false,
      }, { transaction });

      await queryInterface.removeColumn(TABLE, 'url', { transaction });
      await queryInterface.removeColumn(TABLE, 'corpo', { transaction });
      await queryInterface.removeColumn(TABLE, 'titulo', { transaction });
      await queryInterface.removeColumn(TABLE, 'task_id', { transaction });
      await queryInterface.removeColumn(TABLE, 'comunidad_id', { transaction });
    });
  },
};
