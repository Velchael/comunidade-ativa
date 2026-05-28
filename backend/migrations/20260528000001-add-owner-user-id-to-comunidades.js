'use strict';

const TABLE = 'comunidades';
const USERS_TABLE = 'users';
const COLUMN = 'owner_user_id';
const INDEX_NAME = 'comunidades_owner_user_id_idx';
const FK_NAME = 'comunidades_owner_user_id_fkey';

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

async function indexExists(queryInterface, Sequelize, transaction) {
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
      replacements: { tableName: TABLE, indexName: INDEX_NAME },
      type: Sequelize.QueryTypes.SELECT,
      transaction,
    }
  );

  return rows.length > 0;
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
      replacements: { tableName: TABLE, constraintName: FK_NAME },
      type: Sequelize.QueryTypes.SELECT,
      transaction,
    }
  );

  return rows.length > 0;
}

async function hasUnsafeOwnerReferences(queryInterface, Sequelize, transaction) {
  const rows = await queryInterface.sequelize.query(
    `
      SELECT COUNT(*)::int AS count
      FROM comunidades c
      LEFT JOIN users u ON u.id = c.owner_user_id
      WHERE c.owner_user_id IS NOT NULL
        AND u.id IS NULL
    `,
    {
      type: Sequelize.QueryTypes.SELECT,
      transaction,
    }
  );

  return rows[0].count > 0;
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const comunidadesExists = await tableExists(queryInterface, TABLE, transaction);
      if (!comunidadesExists) {
        return;
      }

      const columns = await getColumns(queryInterface, TABLE, transaction);
      if (!columns[COLUMN]) {
        await queryInterface.addColumn(
          TABLE,
          COLUMN,
          {
            type: Sequelize.INTEGER,
            allowNull: true,
          },
          { transaction }
        );
      }

      if (!(await indexExists(queryInterface, Sequelize, transaction))) {
        await queryInterface.addIndex(TABLE, [COLUMN], {
          name: INDEX_NAME,
          transaction,
        });
      }

      const usersExists = await tableExists(queryInterface, USERS_TABLE, transaction);
      const fkExists = await constraintExists(queryInterface, Sequelize, transaction);
      const unsafeReferences = usersExists
        ? await hasUnsafeOwnerReferences(queryInterface, Sequelize, transaction)
        : true;

      if (usersExists && !fkExists && !unsafeReferences) {
        await queryInterface.addConstraint(TABLE, {
          fields: [COLUMN],
          type: 'foreign key',
          name: FK_NAME,
          references: {
            table: USERS_TABLE,
            field: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
          transaction,
        });
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const comunidadesExists = await tableExists(queryInterface, TABLE, transaction);
      if (!comunidadesExists) {
        return;
      }

      if (await constraintExists(queryInterface, Sequelize, transaction)) {
        await queryInterface.removeConstraint(TABLE, FK_NAME, { transaction });
      }

      if (await indexExists(queryInterface, Sequelize, transaction)) {
        await queryInterface.removeIndex(TABLE, INDEX_NAME, { transaction });
      }

      const columns = await getColumns(queryInterface, TABLE, transaction);
      if (columns[COLUMN]) {
        await queryInterface.removeColumn(TABLE, COLUMN, { transaction });
      }
    });
  },
};
