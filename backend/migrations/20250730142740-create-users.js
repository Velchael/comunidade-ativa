'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('users', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      googleid: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: true,
      },
      username: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      apellido: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false,
      },
      password: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      rol: {
        type: Sequelize.ENUM('admin_total', 'admin_basic', 'miembro'),
        defaultValue: 'miembro',
        allowNull: false,
      },
      fecha_nacimiento: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      telefono: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      direccion: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      nivel_liderazgo: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      grupo_familiar_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      estado: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      foto_perfil: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      confirmed: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      comunidad_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'comunidades',
          key: 'id'
        },
        allowNull: true,
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('users');
  }
};

