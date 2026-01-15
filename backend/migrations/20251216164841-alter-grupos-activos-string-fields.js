'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Eliminar constraints de foreign key si existen
      try {
        await queryInterface.removeConstraint('grupos_activos', 'grupos_activos_colider_id_fkey', { transaction });
      } catch (error) {
        console.log('Constraint colider_id no encontrado');
      }
      
      try {
        await queryInterface.removeConstraint('grupos_activos', 'grupos_activos_anfitrion_id_fkey', { transaction });
      } catch (error) {
        console.log('Constraint anfitrion_id no encontrado');
      }
      
      // Alterar colider_id de INTEGER para VARCHAR
      await queryInterface.changeColumn('grupos_activos', 'colider_id', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction });

      // Alterar anfitrion_id de INTEGER para VARCHAR (si existe)
      const tableDescription = await queryInterface.describeTable('grupos_activos');
      if (tableDescription.anfitrion_id) {
        await queryInterface.changeColumn('grupos_activos', 'anfitrion_id', {
          type: Sequelize.STRING,
          allowNull: true
        }, { transaction });
      }
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Reverter colider_id para INTEGER
      await queryInterface.changeColumn('grupos_activos', 'colider_id', {
        type: Sequelize.INTEGER,
        allowNull: true
      }, { transaction });

      // Reverter anfitrion_id para INTEGER (si existe)
      const tableDescription = await queryInterface.describeTable('grupos_activos');
      if (tableDescription.anfitrion_id) {
        await queryInterface.changeColumn('grupos_activos', 'anfitrion_id', {
          type: Sequelize.INTEGER,
          allowNull: true
        }, { transaction });
      }
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
