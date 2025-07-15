const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const User = require('./User');

const Task = sequelize.define('Task', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  frequency: {
    type: DataTypes.ENUM('semanal', 'mensual', 'anual'),
    allowNull: false
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'created_by', // 👈 match con PostgreSQL
    references: {
      model: 'users',
      key: 'id'
    }
  },
  dueDate: {
  type: DataTypes.DATEONLY,
  allowNull: false,
  field: 'due_date'
  },
  status: {
  type: DataTypes.ENUM('pendiente', 'en_progreso', 'completada', 'cancelada'),
  allowNull: false,
  defaultValue: 'pendiente'
  },
  priority: {
  type: DataTypes.ENUM('baja', 'media', 'alta'),
  allowNull: false,
  defaultValue: 'media'
  }
  
}, {
  tableName: 'tasks',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Relación con usuario (1:N)
Task.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
User.hasMany(Task, { foreignKey: 'createdBy' });

module.exports = Task;
