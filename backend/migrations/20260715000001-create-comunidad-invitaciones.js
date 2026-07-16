'use strict';

const TABLE = 'comunidad_invitaciones';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(TABLE, {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER,
        },
        token_hash: {
          allowNull: false,
          type: Sequelize.STRING(64),
        },
        comunidad_id: {
          allowNull: false,
          type: Sequelize.INTEGER,
          references: {
            model: 'comunidades',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        created_by_user_id: {
          allowNull: false,
          type: Sequelize.INTEGER,
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        estado: {
          allowNull: false,
          type: Sequelize.STRING,
          defaultValue: 'activa',
        },
        expires_at: {
          allowNull: false,
          type: Sequelize.DATE,
        },
        max_usos: {
          allowNull: false,
          type: Sequelize.INTEGER,
          defaultValue: 1,
        },
        usos_actuales: {
          allowNull: false,
          type: Sequelize.INTEGER,
          defaultValue: 0,
        },
        created_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('NOW()'),
        },
        updated_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('NOW()'),
        },
        revoked_at: {
          allowNull: true,
          type: Sequelize.DATE,
        },
        revoked_by_user_id: {
          allowNull: true,
          type: Sequelize.INTEGER,
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        last_used_at: {
          allowNull: true,
          type: Sequelize.DATE,
        },
      }, { transaction });

      await queryInterface.addConstraint(TABLE, {
        fields: ['token_hash'],
        type: 'unique',
        name: 'comunidad_invitaciones_token_hash_key',
        transaction,
      });

      await queryInterface.addIndex(TABLE, ['comunidad_id'], {
        name: 'comunidad_invitaciones_comunidad_id_idx',
        transaction,
      });

      await queryInterface.addIndex(TABLE, ['comunidad_id', 'estado'], {
        name: 'comunidad_invitaciones_comunidad_id_estado_idx',
        transaction,
      });

      await queryInterface.addIndex(TABLE, ['expires_at'], {
        name: 'comunidad_invitaciones_expires_at_idx',
        transaction,
      });

      await queryInterface.addIndex(TABLE, ['created_by_user_id'], {
        name: 'comunidad_invitaciones_created_by_user_id_idx',
        transaction,
      });

      await queryInterface.addIndex(TABLE, ['revoked_by_user_id'], {
        name: 'comunidad_invitaciones_revoked_by_user_id_idx',
        transaction,
      });

      await queryInterface.sequelize.query(`
        ALTER TABLE comunidad_invitaciones
        ADD CONSTRAINT comunidad_invitaciones_estado_check
        CHECK (estado IN ('activa', 'revocada', 'agotada'))
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE comunidad_invitaciones
        ADD CONSTRAINT comunidad_invitaciones_token_hash_format_check
        CHECK (token_hash ~ '^[0-9a-f]{64}$')
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE comunidad_invitaciones
        ADD CONSTRAINT comunidad_invitaciones_max_usos_check
        CHECK (max_usos >= 1 AND max_usos <= 100)
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE comunidad_invitaciones
        ADD CONSTRAINT comunidad_invitaciones_usos_actuales_check
        CHECK (usos_actuales >= 0 AND usos_actuales <= max_usos)
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE comunidad_invitaciones
        ADD CONSTRAINT comunidad_invitaciones_expires_after_created_check
        CHECK (expires_at > created_at)
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE comunidad_invitaciones
        ADD CONSTRAINT comunidad_invitaciones_expires_max_30_days_check
        CHECK (expires_at <= created_at + INTERVAL '30 days')
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE comunidad_invitaciones
        ADD CONSTRAINT comunidad_invitaciones_revocacion_check
        CHECK (
          (estado = 'revocada' AND revoked_at IS NOT NULL)
          OR
          (estado <> 'revocada' AND revoked_at IS NULL AND revoked_by_user_id IS NULL)
        )
      `, { transaction });
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable(TABLE);
  },
};
