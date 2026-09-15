'use strict';

const CONVERSAS_TABLE = 'conversas_privadas';
const MENSAGENS_TABLE = 'conversa_mensagens';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(CONVERSAS_TABLE, {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        comunidad_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'comunidades',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        participante_1_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        participante_2_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        origin_interaccion_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        last_message_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('NOW()'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('NOW()'),
        },
      }, { transaction });

      await queryInterface.addConstraint(CONVERSAS_TABLE, {
        fields: ['participante_1_id', 'participante_2_id'],
        type: 'check',
        name: 'conversas_privadas_participantes_ordenados_check',
        where: Sequelize.literal('participante_1_id < participante_2_id'),
        transaction,
      });

      await queryInterface.addConstraint(CONVERSAS_TABLE, {
        fields: ['comunidad_id', 'participante_1_id', 'participante_2_id'],
        type: 'unique',
        name: 'conversas_privadas_comunidad_participantes_key',
        transaction,
      });

      await queryInterface.addIndex(CONVERSAS_TABLE, ['participante_1_id', {
        name: 'last_message_at',
        order: 'DESC',
      }], {
        name: 'conversas_privadas_p1_last_message_at_idx',
        transaction,
      });

      await queryInterface.addIndex(CONVERSAS_TABLE, ['participante_2_id', {
        name: 'last_message_at',
        order: 'DESC',
      }], {
        name: 'conversas_privadas_p2_last_message_at_idx',
        transaction,
      });

      await queryInterface.createTable(MENSAGENS_TABLE, {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        conversa_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: CONVERSAS_TABLE,
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        sender_user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        corpo: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        read_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('NOW()'),
        },
      }, { transaction });

      await queryInterface.addIndex(MENSAGENS_TABLE, ['conversa_id', 'id'], {
        name: 'conversa_mensagens_conversa_id_id_idx',
        transaction,
      });
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable(MENSAGENS_TABLE, { transaction });
      await queryInterface.dropTable(CONVERSAS_TABLE, { transaction });
    });
  },
};
