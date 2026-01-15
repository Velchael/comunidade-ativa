'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Verificar si la columna existe y su tipo
      const tableDescription = await queryInterface.describeTable('grupos_activos');
      
      if (tableDescription.colider_id && tableDescription.colider_id.type.includes('character varying')) {
        console.log('Columna colider_id encontrada con tipo incorrecto, corrigiendo...');
        
        // Primero eliminar el constraint de foreign key si existe
        try {
          await queryInterface.removeConstraint('grupos_activos', 'grupos_activos_colider_id_fkey', { transaction });
          console.log('Constraint de foreign key eliminado');
        } catch (error) {
          console.log('No se encontró constraint de foreign key o ya fue eliminado');
        }
        
        // Eliminar la columna existente
        await queryInterface.removeColumn('grupos_activos', 'colider_id', { transaction });
        
        // Recrear la columna con el tipo correcto
        await queryInterface.addColumn('grupos_activos', 'colider_id', {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id'
          }
        }, { transaction });
        
        console.log('Columna colider_id corregida exitosamente');
      } else {
        console.log('Columna colider_id ya tiene el tipo correcto o no existe');
      }
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Revertir: eliminar columna INTEGER y recrear como VARCHAR
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
