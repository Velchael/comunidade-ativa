'use strict';

const TABLE = 'comunidad_invitaciones';

const MAX_USOS_CHECK = 'comunidad_invitaciones_max_usos_check';
const USOS_ACTUALES_CHECK = 'comunidad_invitaciones_usos_actuales_check';
const EXPIRES_AFTER_CREATED_CHECK = 'comunidad_invitaciones_expires_after_created_check';
const EXPIRES_MAX_30_DAYS_CHECK = 'comunidad_invitaciones_expires_max_30_days_check';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        ALTER TABLE ${TABLE}
        DROP CONSTRAINT ${MAX_USOS_CHECK},
        DROP CONSTRAINT ${USOS_ACTUALES_CHECK},
        DROP CONSTRAINT ${EXPIRES_AFTER_CREATED_CHECK},
        DROP CONSTRAINT ${EXPIRES_MAX_30_DAYS_CHECK}
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE ${TABLE}
        ALTER COLUMN max_usos DROP NOT NULL,
        ALTER COLUMN expires_at DROP NOT NULL
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE ${TABLE}
        ADD CONSTRAINT ${MAX_USOS_CHECK}
        CHECK (
          max_usos IS NULL
          OR (max_usos >= 1 AND max_usos <= 100)
        ),
        ADD CONSTRAINT ${USOS_ACTUALES_CHECK}
        CHECK (
          usos_actuales >= 0
          AND (
            max_usos IS NULL
            OR usos_actuales <= max_usos
          )
        ),
        ADD CONSTRAINT ${EXPIRES_AFTER_CREATED_CHECK}
        CHECK (
          expires_at IS NULL
          OR expires_at > created_at
        ),
        ADD CONSTRAINT ${EXPIRES_MAX_30_DAYS_CHECK}
        CHECK (
          expires_at IS NULL
          OR expires_at <= created_at + INTERVAL '30 days'
        )
      `, { transaction });
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        ALTER TABLE ${TABLE}
        DROP CONSTRAINT ${MAX_USOS_CHECK},
        DROP CONSTRAINT ${USOS_ACTUALES_CHECK},
        DROP CONSTRAINT ${EXPIRES_AFTER_CREATED_CHECK},
        DROP CONSTRAINT ${EXPIRES_MAX_30_DAYS_CHECK}
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE ${TABLE}
        ADD CONSTRAINT ${MAX_USOS_CHECK}
        CHECK (max_usos >= 1 AND max_usos <= 100),
        ADD CONSTRAINT ${USOS_ACTUALES_CHECK}
        CHECK (usos_actuales >= 0 AND usos_actuales <= max_usos),
        ADD CONSTRAINT ${EXPIRES_AFTER_CREATED_CHECK}
        CHECK (expires_at > created_at),
        ADD CONSTRAINT ${EXPIRES_MAX_30_DAYS_CHECK}
        CHECK (expires_at <= created_at + INTERVAL '30 days')
      `, { transaction });

      // Safe rollback only: this intentionally does not invent values for
      // invitations created with NULL max_usos or expires_at after this migration.
      // If such rows exist, SET NOT NULL will fail and the transaction will roll back.
      await queryInterface.sequelize.query(`
        ALTER TABLE ${TABLE}
        ALTER COLUMN max_usos SET NOT NULL,
        ALTER COLUMN expires_at SET NOT NULL
      `, { transaction });
    });
  },
};
