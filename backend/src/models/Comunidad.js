module.exports = (sequelize, DataTypes) => {
  const Comunidad = sequelize.define('Comunidad', {
    nombre: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    descripcion: {
      type: DataTypes.TEXT,
    },
    direccion: {
      type: DataTypes.STRING,
    },
    telefono: {
      type: DataTypes.STRING,
    },
    administrador: {
      type: DataTypes.STRING,
    },
    activa: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  });

  return Comunidad;
};
