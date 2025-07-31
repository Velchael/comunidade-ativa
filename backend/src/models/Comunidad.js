module.exports = (sequelize, DataTypes) => {
  const Comunidad = sequelize.define('Comunidad', {
    nombre_comunidad: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      field: 'nombre_comunidad'
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
    nombre_administrador: {
      type: DataTypes.STRING,
      field: 'nombre_administrador'
    },
    activa: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    tableName: 'comunidades',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  Comunidad.associate = (models) => {
    Comunidad.hasMany(models.Usuario, {
      foreignKey: 'comunidad_id',
      as: 'usuarios'
    });
  };

  return Comunidad;
};

