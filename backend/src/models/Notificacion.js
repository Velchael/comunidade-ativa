const TIPOS_NOTIFICACION = [
  "respuesta_interaccion",
  "agenda_task_created",
  "agenda_task_updated",
  "agenda_task_cancelled",
  "agenda_task_deleted",
  "mensagem_privada"
];

module.exports = (sequelize, DataTypes) => {
  const Notificacion = sequelize.define("Notificacion", {
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    actor_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    tipo: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [TIPOS_NOTIFICACION]
      }
    },
    interaccion_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    respuesta_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    comunidad_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "comunidades",
        key: "id"
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    },
    task_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    titulo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    corpo: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    url: {
      type: DataTypes.STRING,
      allowNull: true
    },
    leida: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    tableName: "notificaciones",
    timestamps: false
  });

  Notificacion.associate = (models) => {
    Notificacion.belongsTo(models.User, {
      foreignKey: "actor_user_id",
      as: "actor"
    });
  };

  return Notificacion;
};

module.exports.TIPOS_NOTIFICACION = TIPOS_NOTIFICACION;
