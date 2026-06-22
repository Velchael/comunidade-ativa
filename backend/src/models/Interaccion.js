module.exports = (sequelize, DataTypes) => {
  const Interaccion = sequelize.define("Interaccion", {
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    comunidad_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    tipo: {
      type: DataTypes.STRING,
      allowNull: false
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    visibilidad: {
      type: DataTypes.STRING,
      defaultValue: "global"
    },
    estado: {
      type: DataTypes.STRING,
      defaultValue: "abierto",
      validate: {
        isIn: [["abierto", "cerrado", "en_proceso", "oculto"]]
      }
    },
    categoria: {
      type: DataTypes.STRING,
      defaultValue: "serviço"
    },
    urgencia: {
      type: DataTypes.STRING,
      defaultValue: "normal"
    },
    imagen_url: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: "interacciones",
    timestamps: false
  });

  Interaccion.associate = (models) => {
  Interaccion.belongsTo(models.User, {
    foreignKey: "user_id",
    as: "usuario"
  });

  Interaccion.belongsTo(models.Comunidad, {
    foreignKey: "comunidad_id",
    as: "comunidad"
  });

  Interaccion.hasMany(models.Respuesta, {
    foreignKey: "interaccion_id",
    as: "respuestas"
  });
};
return Interaccion; 
};
