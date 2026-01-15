'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      const tableDescription = await queryInterface.describeTable('grupos_activos');
      
      // Si colider_id es STRING, cambiarlo a INTEGER
      if (tableDescription.colider_id && tableDescription.colider_id.type.includes('character varying')) {
        console.log('Cambiando colider_id de STRING a INTEGER...');
        
        // Eliminar la columna STRING
        await queryInterface.removeColumn('grupos_activos', 'colider_id', { transaction });
        
        // Crear la columna INTEGER
        await queryInterface.addColumn('grupos_activos', 'colider_id', {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id'
          }
        }, { transaction });
      }
      
      // Asegurar que colider_nombre existe
      if (!tableDescription.colider_nombre) {
        console.log('Agregando columna colider_nombre...');
        await queryInterface.addColumn('grupos_activos', 'colider_nombre', {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: ''
        }, { transaction });
      }
      
      // Asegurar que anfitrion_nombre existe
      if (!tableDescription.anfitrion_nombre) {
        console.log('Agregando columna anfitrion_nombre...');
        await queryInterface.addColumn('grupos_activos', 'anfitrion_nombre', {
          type: Sequelize.STRING,
          allowNull: true
        }, { transaction });
      }
      
      // Eliminar anfitrion_id si existe (no está en el modelo)
      if (tableDescription.anfitrion_id) {
        console.log('Eliminando columna anfitrion_id...');
        await queryInterface.removeColumn('grupos_activos', 'anfitrion_id', { transaction });
      }
      
      await transaction.commit();
      console.log('Estructura de tabla corregida exitosamente');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Revertir cambios
      await queryInterface.removeColumn('grupos_activos', 'colider_id', { transaction });
      await queryInterface.addColumn('grupos_activos', 'colider_id', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
