'use strict';

const TABLE = 'notificaciones';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(TABLE, {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        actor_user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        tipo: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        interaccion_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        respuesta_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        leida: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('NOW()'),
        },
      }, { transaction });

      await queryInterface.addIndex(TABLE, [
        'user_id',
        'leida',
        { name: 'created_at', order: 'DESC' },
      ], {
        name: 'notificaciones_user_id_leida_created_at_idx',
        transaction,
      });

      await queryInterface.addIndex(TABLE, [
        'user_id',
        { name: 'created_at', order: 'DESC' },
      ], {
        name: 'notificaciones_user_id_created_at_idx',
        transaction,
      });

      await queryInterface.sequelize.query(`
        ALTER TABLE notificaciones
        ADD CONSTRAINT notificaciones_tipo_check
        CHECK (tipo IN ('respuesta_interaccion'))
      `, { transaction });
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable(TABLE);
  },
};
