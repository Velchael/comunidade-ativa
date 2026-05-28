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
    owner_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'owner_user_id'
    },
    objetivo: { type: DataTypes.TEXT, allowNull: true },
    tipo: { type: DataTypes.STRING, allowNull: true },
    visibilidad: { type: DataTypes.STRING, allowNull: true, defaultValue: 'publica' },
    ciudad: { type: DataTypes.STRING, allowNull: true },
    pais: { type: DataTypes.STRING, allowNull: true },
  }, {
    tableName: 'comunidades',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  Comunidad.associate = (models) => {
    Comunidad.hasMany(models.User, {
      foreignKey: 'comunidad_id',
      as: 'usuarios'
    });

    Comunidad.hasMany(models.ComunidadMiembro, {
      foreignKey: 'comunidad_id',
      as: 'miembros'
    });

    Comunidad.belongsToMany(models.User, {
      through: models.ComunidadMiembro,
      foreignKey: 'comunidad_id',
      otherKey: 'user_id',
      as: 'usuarios_miembros'
    });
  };

  return Comunidad;
};
