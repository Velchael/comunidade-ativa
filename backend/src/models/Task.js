// models/Task.js

module.exports = (sequelize, DataTypes) => {
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
      field: 'created_by',
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

  // ✅ Asociación diferida (para evitar dependencias cruzadas)
  Task.associate = (models) => {
    Task.belongsTo(models.Usuario, {
      foreignKey: 'createdBy',
      as: 'creator'
    });
  };

  return Task;
};
