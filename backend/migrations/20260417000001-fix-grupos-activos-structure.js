'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {

    // agregar columnas nuevas
    await queryInterface.addColumn('grupos_activos', 'colider_nombre', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('grupos_activos', 'anfitrion_nombre', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // eliminar columna vieja
    await queryInterface.removeColumn('grupos_activos', 'anfitrion_id');
  },

  async down(queryInterface, Sequelize) {

    // volver atrás (rollback)
    await queryInterface.addColumn('grupos_activos', 'anfitrion_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.removeColumn('grupos_activos', 'colider_nombre');
    await queryInterface.removeColumn('grupos_activos', 'anfitrion_nombre');
  }
};

