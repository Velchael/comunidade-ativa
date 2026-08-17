'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('interacciones', 'imagen_key', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('interacciones', 'imagen_key');
  }
};
