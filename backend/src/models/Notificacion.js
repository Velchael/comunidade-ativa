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
        isIn: [["respuesta_interaccion"]]
      }
    },
    interaccion_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    respuesta_id: {
      type: DataTypes.INTEGER,
      allowNull: false
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
