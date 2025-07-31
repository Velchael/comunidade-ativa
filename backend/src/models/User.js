module.exports = (sequelize, DataTypes) => {
  const Usuario = sequelize.define('Usuario', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    googleId: {
      type: DataTypes.STRING,
      unique: true,
      field: 'googleid'
    },
    username: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    apellido: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      validate: { isEmail: true }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    rol: {
      type: DataTypes.ENUM('admin_total', 'admin_basic', 'miembro'), // actualiza si deseas roles más precisos
      defaultValue: 'miembro'
    },
    fecha_nacimiento: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'fecha_nacimiento'
    },
    telefono: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    direccion: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    nivel_liderazgo: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'nivel_liderazgo'
    },
    grupo_familiar_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'grupo_familiar_id'
    },
    estado: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    foto_perfil: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'foto_perfil'
    },
    confirmed: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    comunidad_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'comunidades', // el nombre real de la tabla, en minúscula
        key: 'id'
      }
    }
  }, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  // ✅ Asociaciones aquí, centralizadas
  Usuario.associate = (models) => {
    Usuario.belongsTo(models.Comunidad, {
      foreignKey: 'comunidad_id',
      as: 'comunidad'
    });
  };

  return Usuario;
};

