'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reuniones_grupo', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      grupo_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'grupos_activos',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      fecha: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      tema_compartido: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      asistentes_regulares: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      nuevos_asistentes: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      observaciones: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      creado_por: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      creado_en: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('reuniones_grupo');
  }
};

