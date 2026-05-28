module.exports = (sequelize, DataTypes) => {
  const ComunidadMiembro = sequelize.define('ComunidadMiembro', {
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      field: 'user_id'
    },
    comunidad_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'comunidades',
        key: 'id'
      },
      field: 'comunidad_id'
    },
    rol_comunidad: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'miembro',
      validate: {
        isIn: [['admin_total', 'admin_basic', 'miembro']]
      },
      field: 'rol_comunidad'
    },
    estado: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'activo',
      validate: {
        isIn: [['activo', 'inactivo']]
      },
      field: 'estado'
    },
    es_principal: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'es_principal'
    }
  }, {
    tableName: 'comunidad_miembros',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'comunidad_id']
      },
      {
        fields: ['user_id']
      },
      {
        fields: ['comunidad_id']
      },
      {
        fields: ['comunidad_id', 'estado']
      }
    ]
  });

  ComunidadMiembro.associate = (models) => {
    ComunidadMiembro.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });

    ComunidadMiembro.belongsTo(models.Comunidad, {
      foreignKey: 'comunidad_id',
      as: 'comunidad'
    });
  };

  return ComunidadMiembro;
};
