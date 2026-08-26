'use strict';

const TABLE = 'auth_sessions';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(TABLE, {
        id: {
          type: Sequelize.UUID,
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
        family_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        refresh_token_hash: {
          type: Sequelize.BLOB,
          allowNull: false,
        },
        previous_refresh_token_hash: {
          type: Sequelize.BLOB,
          allowNull: true,
        },
        rotation_counter: {
          type: Sequelize.BIGINT,
          allowNull: false,
          defaultValue: 0,
        },
        rotated_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        previous_valid_until: {
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
        last_used_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('NOW()'),
        },
        expires_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        absolute_expires_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        revoked_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        revoked_reason: {
          type: Sequelize.STRING(32),
          allowNull: true,
        },
      }, { transaction });

      await queryInterface.addConstraint(TABLE, {
        fields: ['family_id'],
        type: 'unique',
        name: 'auth_sessions_family_id_key',
        transaction,
      });

      await queryInterface.addConstraint(TABLE, {
        fields: ['refresh_token_hash'],
        type: 'unique',
        name: 'auth_sessions_refresh_token_hash_key',
        transaction,
      });

      await queryInterface.addIndex(TABLE, ['user_id'], {
        name: 'auth_sessions_user_id_idx',
        transaction,
      });

      await queryInterface.addIndex(TABLE, ['expires_at', 'id'], {
        name: 'auth_sessions_expires_at_id_idx',
        transaction,
      });

      await queryInterface.sequelize.query(`
        ALTER TABLE auth_sessions
        ADD CONSTRAINT auth_sessions_refresh_token_hash_length_check
        CHECK (octet_length(refresh_token_hash) = 32)
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE auth_sessions
        ADD CONSTRAINT auth_sessions_previous_refresh_token_hash_length_check
        CHECK (
          previous_refresh_token_hash IS NULL
          OR octet_length(previous_refresh_token_hash) = 32
        )
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE auth_sessions
        ADD CONSTRAINT auth_sessions_rotation_counter_check
        CHECK (rotation_counter >= 0)
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE auth_sessions
        ADD CONSTRAINT auth_sessions_expiration_order_check
        CHECK (expires_at <= absolute_expires_at)
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE auth_sessions
        ADD CONSTRAINT auth_sessions_expires_after_created_check
        CHECK (expires_at > created_at)
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE auth_sessions
        ADD CONSTRAINT auth_sessions_absolute_expires_after_created_check
        CHECK (absolute_expires_at > created_at)
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE auth_sessions
        ADD CONSTRAINT auth_sessions_revocation_consistency_check
        CHECK (
          (revoked_at IS NULL AND revoked_reason IS NULL)
          OR
          (revoked_at IS NOT NULL AND revoked_reason IS NOT NULL)
        )
      `, { transaction });
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable(TABLE);
  },
};
