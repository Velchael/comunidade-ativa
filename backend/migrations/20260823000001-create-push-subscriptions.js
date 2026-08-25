'use strict';

const TABLE = 'push_subscriptions';

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
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        endpoint: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        p256dh: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        auth: {
          type: Sequelize.TEXT,
          allowNull: false,
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

      await queryInterface.addConstraint(TABLE, {
        fields: ['endpoint'],
        type: 'unique',
        name: 'push_subscriptions_endpoint_key',
        transaction,
      });

      await queryInterface.addIndex(TABLE, ['user_id'], {
        name: 'push_subscriptions_user_id_idx',
        transaction,
      });
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable(TABLE);
  },
};
