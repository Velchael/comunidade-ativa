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
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    due_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
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
    },
    comunidad_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'comunidades',
        key: 'id'
      }
    }
  }, {
    tableName: 'tasks',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  Task.associate = (models) => {
    Task.belongsTo(models.Usuario, {
      foreignKey: 'created_by',
      as: 'creator'
    });
    Task.belongsTo(models.Comunidad, {
      foreignKey: 'comunidad_id',
      as: 'comunidad'
    });
  };

  return Task;
};

