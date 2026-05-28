'use strict';

const TABLE = 'comunidad_miembros';
const USERS_TABLE = 'users';
const COMUNIDADES_TABLE = 'comunidades';

const UNIQUE_NAME = 'comunidad_miembros_user_id_comunidad_id_key';
const USER_FK_NAME = 'comunidad_miembros_user_id_fkey';
const COMUNIDAD_FK_NAME = 'comunidad_miembros_comunidad_id_fkey';
const ROL_CHECK_NAME = 'comunidad_miembros_rol_comunidad_check';
const ESTADO_CHECK_NAME = 'comunidad_miembros_estado_check';
const USER_INDEX_NAME = 'comunidad_miembros_user_id_idx';
const COMUNIDAD_INDEX_NAME = 'comunidad_miembros_comunidad_id_idx';
const COMUNIDAD_ESTADO_INDEX_NAME = 'comunidad_miembros_comunidad_id_estado_idx';

async function tableExists(queryInterface, tableName, transaction) {
  try {
    await queryInterface.describeTable(tableName, { transaction });
    return true;
  } catch (error) {
    return false;
  }
}

async function constraintExists(queryInterface, Sequelize, tableName, constraintName, transaction) {
  const rows = await queryInterface.sequelize.query(
    `
      SELECT 1
      FROM pg_constraint
      WHERE conname = :constraintName
        AND conrelid = :tableName::regclass
      LIMIT 1
    `,
    {
      replacements: { tableName, constraintName },
      type: Sequelize.QueryTypes.SELECT,
      transaction,
    }
  );

  return rows.length > 0;
}

async function indexExists(queryInterface, Sequelize, indexName, transaction) {
  const rows = await queryInterface.sequelize.query(
    `
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename = :tableName
        AND indexname = :indexName
      LIMIT 1
    `,
    {
      replacements: { tableName: TABLE, indexName },
      type: Sequelize.QueryTypes.SELECT,
      transaction,
    }
  );

  return rows.length > 0;
}

async function addCheckConstraint(queryInterface, constraintName, condition, transaction) {
  await queryInterface.sequelize.query(
    `
      ALTER TABLE comunidad_miembros
      ADD CONSTRAINT ${constraintName}
      CHECK (${condition})
    `,
    { transaction }
  );
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const usersExists = await tableExists(queryInterface, USERS_TABLE, transaction);
      const comunidadesExists = await tableExists(queryInterface, COMUNIDADES_TABLE, transaction);
      if (!usersExists || !comunidadesExists) {
        return;
      }

      const comunidadMiembrosExists = await tableExists(queryInterface, TABLE, transaction);
      if (!comunidadMiembrosExists) {
        await queryInterface.createTable(
          TABLE,
          {
            id: {
              allowNull: false,
              autoIncrement: true,
              primaryKey: true,
              type: Sequelize.INTEGER,
            },
            user_id: {
              allowNull: false,
              type: Sequelize.INTEGER,
            },
            comunidad_id: {
              allowNull: false,
              type: Sequelize.INTEGER,
            },
            rol_comunidad: {
              allowNull: false,
              type: Sequelize.STRING,
              defaultValue: 'miembro',
            },
            estado: {
              allowNull: false,
              type: Sequelize.STRING,
              defaultValue: 'activo',
            },
            es_principal: {
              allowNull: false,
              type: Sequelize.BOOLEAN,
              defaultValue: true,
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
          },
          { transaction }
        );
      }

      if (!(await constraintExists(queryInterface, Sequelize, TABLE, USER_FK_NAME, transaction))) {
        await queryInterface.addConstraint(TABLE, {
          fields: ['user_id'],
          type: 'foreign key',
          name: USER_FK_NAME,
          references: {
            table: USERS_TABLE,
            field: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
          transaction,
        });
      }

      if (!(await constraintExists(queryInterface, Sequelize, TABLE, COMUNIDAD_FK_NAME, transaction))) {
        await queryInterface.addConstraint(TABLE, {
          fields: ['comunidad_id'],
          type: 'foreign key',
          name: COMUNIDAD_FK_NAME,
          references: {
            table: COMUNIDADES_TABLE,
            field: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
          transaction,
        });
      }

      if (!(await constraintExists(queryInterface, Sequelize, TABLE, UNIQUE_NAME, transaction))) {
        await queryInterface.addConstraint(TABLE, {
          fields: ['user_id', 'comunidad_id'],
          type: 'unique',
          name: UNIQUE_NAME,
          transaction,
        });
      }

      if (!(await constraintExists(queryInterface, Sequelize, TABLE, ROL_CHECK_NAME, transaction))) {
        await addCheckConstraint(
          queryInterface,
          ROL_CHECK_NAME,
          "rol_comunidad IN ('admin_total', 'admin_basic', 'miembro')",
          transaction
        );
      }

      if (!(await constraintExists(queryInterface, Sequelize, TABLE, ESTADO_CHECK_NAME, transaction))) {
        await addCheckConstraint(
          queryInterface,
          ESTADO_CHECK_NAME,
          "estado IN ('activo', 'inactivo')",
          transaction
        );
      }

      if (!(await indexExists(queryInterface, Sequelize, USER_INDEX_NAME, transaction))) {
        await queryInterface.addIndex(TABLE, ['user_id'], {
          name: USER_INDEX_NAME,
          transaction,
        });
      }

      if (!(await indexExists(queryInterface, Sequelize, COMUNIDAD_INDEX_NAME, transaction))) {
        await queryInterface.addIndex(TABLE, ['comunidad_id'], {
          name: COMUNIDAD_INDEX_NAME,
          transaction,
        });
      }

      if (!(await indexExists(queryInterface, Sequelize, COMUNIDAD_ESTADO_INDEX_NAME, transaction))) {
        await queryInterface.addIndex(TABLE, ['comunidad_id', 'estado'], {
          name: COMUNIDAD_ESTADO_INDEX_NAME,
          transaction,
        });
      }

      await queryInterface.sequelize.query(
        `
          INSERT INTO comunidad_miembros (
            user_id,
            comunidad_id,
            rol_comunidad,
            estado,
            es_principal,
            created_at,
            updated_at
          )
          SELECT
            u.id,
            u.comunidad_id,
            u.rol::text,
            'activo',
            true,
            NOW(),
            NOW()
          FROM users u
          WHERE u.comunidad_id IS NOT NULL
          ON CONFLICT ON CONSTRAINT comunidad_miembros_user_id_comunidad_id_key
          DO NOTHING
        `,
        { transaction }
      );
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const comunidadMiembrosExists = await tableExists(queryInterface, TABLE, transaction);
      if (comunidadMiembrosExists) {
        await queryInterface.dropTable(TABLE, { transaction });
      }
    });
  },
};
