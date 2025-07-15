const { DataTypes } = require('sequelize');
const sequelize = require('../db'); // Asegúrate de que apunta a tu Sequelize `index.js`

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  googleId: {
    type: DataTypes.STRING,
    unique: true,
    field: 'googleid'
  },
  username: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  apellido: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    validate: { isEmail: true }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  rol: {
    type: DataTypes.ENUM('admin', 'usuario'),
    defaultValue: 'usuario'
  },
  fecha_nacimiento: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'fecha_nacimiento'
  },
  telefono: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  direccion: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  nivel_liderazgo: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'nivel_liderazgo'
  },
  grupo_familiar_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'grupo_familiar_id'
  },
  estado: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  foto_perfil: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'foto_perfil'
  },
  confirmed: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',  // 👈 Coincide con tu tabla
  updatedAt: 'updated_at'
});

module.exports = User;
