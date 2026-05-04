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
      defaultValue: "abierto"
    }
  }, {
    tableName: "interacciones",
    timestamps: false
  });

  // 🔗 RELACIÓN
  
  //Interaccion.associate = (models) => {
   // Interaccion.hasMany(models.Respuesta, {
   //   foreignKey: "interaccion_id",
   //   as: "respuestas"
  //  });
  //};
  //return Interaccion;

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