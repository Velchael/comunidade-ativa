
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('grupos_activos', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      comunidad_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'comunidades',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      lider_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      colider_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      anfitrion_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      direccion_grupo: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      creado_en: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      },
      actualizado_en: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('grupos_activos');
  }
};
