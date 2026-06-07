'use strict';

const TABLE = 'comunidad_miembros';
const CONSTRAINT_NAME = 'comunidad_miembros_rol_comunidad_check';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeConstraint(TABLE, CONSTRAINT_NAME, { transaction });

      await queryInterface.sequelize.query(
        `
          ALTER TABLE comunidad_miembros
          ADD CONSTRAINT ${CONSTRAINT_NAME}
          CHECK (rol_comunidad IN ('admin_total', 'admin_basic', 'moderador', 'miembro'))
        `,
        { transaction }
      );
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
          UPDATE comunidad_miembros
          SET rol_comunidad = 'miembro'
          WHERE rol_comunidad = 'moderador'
        `,
        { transaction }
      );

      await queryInterface.removeConstraint(TABLE, CONSTRAINT_NAME, { transaction });

      await queryInterface.sequelize.query(
        `
          ALTER TABLE comunidad_miembros
          ADD CONSTRAINT ${CONSTRAINT_NAME}
          CHECK (rol_comunidad IN ('admin_total', 'admin_basic', 'miembro'))
        `,
        { transaction }
      );
    });
  },
};
