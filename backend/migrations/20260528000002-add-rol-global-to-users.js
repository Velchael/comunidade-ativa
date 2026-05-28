'use strict';

const TABLE = 'users';
const COLUMN = 'rol_global';
const CHECK_NAME = 'users_rol_global_check';
const VALID_ROLES = ['admin_total', 'admin_basic', 'miembro'];

async function tableExists(queryInterface, tableName, transaction) {
  try {
    await queryInterface.describeTable(tableName, { transaction });
    return true;
  } catch (error) {
    return false;
  }
}

async function getColumns(queryInterface, tableName, transaction) {
  try {
    return await queryInterface.describeTable(tableName, { transaction });
  } catch (error) {
    return {};
  }
}

async function constraintExists(queryInterface, Sequelize, transaction) {
  const rows = await queryInterface.sequelize.query(
    `
      SELECT 1
      FROM pg_constraint
      WHERE conname = :constraintName
        AND conrelid = :tableName::regclass
      LIMIT 1
    `,
    {
      replacements: { tableName: TABLE, constraintName: CHECK_NAME },
      type: Sequelize.QueryTypes.SELECT,
      transaction,
    }
  );

  return rows.length > 0;
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const usersExists = await tableExists(queryInterface, TABLE, transaction);
      if (!usersExists) {
        return;
      }

      const columns = await getColumns(queryInterface, TABLE, transaction);

      if (!columns[COLUMN]) {
        await queryInterface.addColumn(
          TABLE,
          COLUMN,
          {
            type: Sequelize.STRING,
            allowNull: true,
          },
          { transaction }
        );
      }

      await queryInterface.sequelize.query(
        `
          UPDATE users
          SET rol_global = rol::text
          WHERE rol_global IS NULL
        `,
        { transaction }
      );

      await queryInterface.changeColumn(
        TABLE,
        COLUMN,
        {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'miembro',
        },
        { transaction }
      );

      if (!(await constraintExists(queryInterface, Sequelize, transaction))) {
        await queryInterface.addConstraint(TABLE, {
          fields: [COLUMN],
          type: 'check',
          name: CHECK_NAME,
          where: {
            [COLUMN]: VALID_ROLES,
          },
          transaction,
        });
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const usersExists = await tableExists(queryInterface, TABLE, transaction);
      if (!usersExists) {
        return;
      }

      if (await constraintExists(queryInterface, Sequelize, transaction)) {
        await queryInterface.removeConstraint(TABLE, CHECK_NAME, { transaction });
      }

      const columns = await getColumns(queryInterface, TABLE, transaction);
      if (columns[COLUMN]) {
        await queryInterface.removeColumn(TABLE, COLUMN, { transaction });
      }
    });
  },
};
