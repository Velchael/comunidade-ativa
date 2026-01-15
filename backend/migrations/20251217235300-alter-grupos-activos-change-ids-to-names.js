'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Remover foreign keys antigas (si existen)
      try {
        await queryInterface.removeConstraint('grupos_activos', 'grupos_activos_colider_id_fkey', { transaction });
      } catch (error) {
        console.log('Constraint colider_id ya fue eliminado');
      }
      
      try {
        await queryInterface.removeConstraint('grupos_activos', 'grupos_activos_anfitrion_id_fkey', { transaction });
      } catch (error) {
        console.log('Constraint anfitrion_id ya fue eliminado');
      }
      
      // Verificar si las columnas existen antes de eliminarlas
      const tableDescription = await queryInterface.describeTable('grupos_activos');
      
      if (tableDescription.colider_id) {
        await queryInterface.removeColumn('grupos_activos', 'colider_id', { transaction });
      }
      
      if (tableDescription.anfitrion_id) {
        await queryInterface.removeColumn('grupos_activos', 'anfitrion_id', { transaction });
      }
      
      // Adicionar novas colunas si no existen
      if (!tableDescription.colider_nombre) {
        await queryInterface.addColumn('grupos_activos', 'colider_nombre', {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: ''
        }, { transaction });
      }
      
      if (!tableDescription.anfitrion_nombre) {
        await queryInterface.addColumn('grupos_activos', 'anfitrion_nombre', {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: ''
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
      // Remover colunas novas
      await queryInterface.removeColumn('grupos_activos', 'colider_nombre', { transaction });
      await queryInterface.removeColumn('grupos_activos', 'anfitrion_nombre', { transaction });
      
      // Restaurar colunas antigas
      await queryInterface.addColumn('grupos_activos', 'colider_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      }, { transaction });
      
      await queryInterface.addColumn('grupos_activos', 'anfitrion_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      }, { transaction });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
