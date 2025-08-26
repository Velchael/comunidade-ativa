'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reportes', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      grupo_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'grupos_activos', key: 'id' },
        onDelete: 'CASCADE'
      },
      creador_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'usuarios', key: 'id' },
        onDelete: 'CASCADE'
      },
      semana: {
        type: Sequelize.DATE,
        allowNull: false
      },
      asistencia: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      tema: {
        type: Sequelize.STRING,
        allowNull: false
      },
      observaciones: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      fecha_creacion: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()')
      },
      fecha_actualizacion: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()')
      }
    });

    await queryInterface.addConstraint('reportes', {
      fields: ['grupo_id', 'semana'],
      type: 'unique',
      name: 'unique_reporte_semana'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('reportes');
  }
};

