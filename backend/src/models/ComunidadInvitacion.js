module.exports = (sequelize, DataTypes) => {
  const ComunidadInvitacion = sequelize.define('ComunidadInvitacion', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    token_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: 'token_hash',
      validate: {
        len: [64, 64],
      },
    },
    comunidad_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'comunidad_id',
    },
    created_by_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'created_by_user_id',
    },
    estado: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'activa',
      validate: {
        isIn: [['activa', 'revocada', 'agotada']],
      },
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at',
    },
    max_usos: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1,
      field: 'max_usos',
      validate: {
        isNullOrAllowedRange(value) {
          if (value === null) return;
          if (!Number.isInteger(value) || value < 1 || value > 100) {
            throw new Error('max_usos deve ser null ou um inteiro entre 1 e 100');
          }
        },
      },
    },
    usos_actuales: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'usos_actuales',
      validate: {
        min: 0,
      },
    },
    revoked_at: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'revoked_at',
    },
    revoked_by_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'revoked_by_user_id',
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_used_at',
    },
  }, {
    tableName: 'comunidad_invitaciones',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  ComunidadInvitacion.associate = (models) => {
    ComunidadInvitacion.belongsTo(models.Comunidad, {
      foreignKey: 'comunidad_id',
      as: 'comunidad',
    });

    ComunidadInvitacion.belongsTo(models.User, {
      foreignKey: 'created_by_user_id',
      as: 'createdBy',
    });

    ComunidadInvitacion.belongsTo(models.User, {
      foreignKey: 'revoked_by_user_id',
      as: 'revokedBy',
    });
  };

  return ComunidadInvitacion;
};
