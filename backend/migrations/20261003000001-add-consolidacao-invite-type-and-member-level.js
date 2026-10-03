'use strict';

const INVITACIONES_TABLE = { schema: 'public', tableName: 'comunidad_invitaciones' };
const MIEMBROS_TABLE = { schema: 'public', tableName: 'comunidad_miembros' };

const INVITACIONES_TIPO_CONSTRAINT = 'comunidad_invitaciones_tipo_check';
const INVITACIONES_TIPO_INDEX = 'comunidad_invitaciones_comunidad_id_tipo_estado_idx';
const MIEMBROS_NIVEL_CONSTRAINT = 'comunidad_miembros_nivel_check';
const MIEMBROS_NIVEL_INDEX = 'comunidad_miembros_comunidad_id_estado_nivel_idx';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(INVITACIONES_TABLE, 'tipo', {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'normal',
      }, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE public.comunidad_invitaciones
        ADD CONSTRAINT ${INVITACIONES_TIPO_CONSTRAINT}
        CHECK (tipo IN ('normal', 'consolidacao'))
      `, { transaction });

      await queryInterface.addIndex(INVITACIONES_TABLE, ['comunidad_id', 'tipo', 'estado'], {
        name: INVITACIONES_TIPO_INDEX,
        transaction,
      });

      await queryInterface.addColumn(MIEMBROS_TABLE, 'nivel', {
        type: Sequelize.STRING(16),
        allowNull: false,
        defaultValue: 'normal',
      }, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE public.comunidad_miembros
        ADD CONSTRAINT ${MIEMBROS_NIVEL_CONSTRAINT}
        CHECK (nivel IN ('normal', '1', '2', '3'))
      `, { transaction });

      await queryInterface.addIndex(MIEMBROS_TABLE, ['comunidad_id', 'estado', 'nivel'], {
        name: MIEMBROS_NIVEL_INDEX,
        transaction,
      });
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex(MIEMBROS_TABLE, MIEMBROS_NIVEL_INDEX, { transaction });
      await queryInterface.removeConstraint(MIEMBROS_TABLE, MIEMBROS_NIVEL_CONSTRAINT, { transaction });
      await queryInterface.removeColumn(MIEMBROS_TABLE, 'nivel', { transaction });

      await queryInterface.removeIndex(INVITACIONES_TABLE, INVITACIONES_TIPO_INDEX, { transaction });
      await queryInterface.removeConstraint(INVITACIONES_TABLE, INVITACIONES_TIPO_CONSTRAINT, { transaction });
      await queryInterface.removeColumn(INVITACIONES_TABLE, 'tipo', { transaction });
    });
  },
};
