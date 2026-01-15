'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Eliminar constraint de foreign key de colider_id si existe
      try {
        await queryInterface.removeConstraint('grupos_activos', 'grupos_activos_colider_id_fkey', { transaction });
        console.log('Constraint grupos_activos_colider_id_fkey eliminado');
      } catch (error) {
        console.log('Constraint grupos_activos_colider_id_fkey no encontrado');
      }
      
      // Eliminar constraint de foreign key de anfitrion_id si existe
      try {
        await queryInterface.removeConstraint('grupos_activos', 'grupos_activos_anfitrion_id_fkey', { transaction });
        console.log('Constraint grupos_activos_anfitrion_id_fkey eliminado');
      } catch (error) {
        console.log('Constraint grupos_activos_anfitrion_id_fkey no encontrado');
      }
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    // No revertir - los constraints se recrearán en migraciones posteriores si es necesario
  }
};
