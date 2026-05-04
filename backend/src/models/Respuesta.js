module.exports = (sequelize, DataTypes) => {
  const Respuesta = sequelize.define("Respuesta", {
    interaccion_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    mensaje: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  }, {
    tableName: "respuestas",
    timestamps: false
  });

  // 🔗 RELACIÓN INVERSA
  //Respuesta.associate = (models) => {
    //Respuesta.belongsTo(models.Interaccion, {
    //  foreignKey: "interaccion_id",
    //  as: "interaccion"
    //});
  //};

  //return Respuesta;

  Respuesta.associate = (models) => {
  Respuesta.belongsTo(models.User, {
    foreignKey: "user_id",
    as: "usuario"
  });

  Respuesta.belongsTo(models.Interaccion, {
    foreignKey: "interaccion_id",
    as: "interaccion"
  });
};
return Respuesta;
};