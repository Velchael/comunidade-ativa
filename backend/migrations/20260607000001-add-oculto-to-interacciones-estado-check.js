'use strict';

const TABLE = 'interacciones';
const CONSTRAINT_NAME = 'interacciones_estado_check';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeConstraint(TABLE, CONSTRAINT_NAME, { transaction });

      await queryInterface.sequelize.query(
        `
          ALTER TABLE interacciones
          ADD CONSTRAINT ${CONSTRAINT_NAME}
          CHECK (estado IN ('abierto', 'cerrado', 'en_proceso', 'oculto'))
        `,
        { transaction }
      );
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
          UPDATE interacciones
          SET estado = 'cerrado'
          WHERE estado = 'oculto'
        `,
        { transaction }
      );

      await queryInterface.removeConstraint(TABLE, CONSTRAINT_NAME, { transaction });

      await queryInterface.sequelize.query(
        `
          ALTER TABLE interacciones
          ADD CONSTRAINT ${CONSTRAINT_NAME}
          CHECK (estado IN ('abierto', 'cerrado', 'en_proceso'))
        `,
        { transaction }
      );
    });
  },
};
