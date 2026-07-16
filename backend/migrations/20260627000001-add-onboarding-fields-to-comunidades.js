'use strict';

const TABLE = 'comunidades';

const COLUMNS = {
  objetivo: {
    type: 'TEXT',
    allowNull: true,
  },
  tipo: {
    type: 'VARCHAR(255)',
    allowNull: true,
  },
  visibilidad: {
    type: 'VARCHAR(255)',
    allowNull: true,
    defaultValue: "'publica'",
  },
  ciudad: {
    type: 'VARCHAR(255)',
    allowNull: true,
  },
  pais: {
    type: 'VARCHAR(255)',
    allowNull: true,
  },
};

async function columnExists(queryInterface, Sequelize, tableName, columnName, transaction) {
  const rows = await queryInterface.sequelize.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = :tableName
        AND column_name = :columnName
      LIMIT 1
    `,
    {
      replacements: { tableName, columnName },
      type: Sequelize.QueryTypes.SELECT,
      transaction,
    }
  );

  return rows.length > 0;
}

function buildColumnSql(columnName, definition) {
  const nullableSql = definition.allowNull === false ? ' NOT NULL' : '';
  const defaultSql = definition.defaultValue ? ` DEFAULT ${definition.defaultValue}` : '';

  return `ADD COLUMN IF NOT EXISTS "${columnName}" ${definition.type}${defaultSql}${nullableSql}`;
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const [columnName, definition] of Object.entries(COLUMNS)) {
        const exists = await columnExists(queryInterface, Sequelize, TABLE, columnName, transaction);

        if (!exists) {
          await queryInterface.sequelize.query(
            `ALTER TABLE "${TABLE}" ${buildColumnSql(columnName, definition)}`,
            { transaction }
          );
        }
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const columnName of Object.keys(COLUMNS).reverse()) {
        const exists = await columnExists(queryInterface, Sequelize, TABLE, columnName, transaction);

        if (exists) {
          await queryInterface.sequelize.query(
            `ALTER TABLE "${TABLE}" DROP COLUMN IF EXISTS "${columnName}"`,
            { transaction }
          );
        }
      }
    });
  },
};
