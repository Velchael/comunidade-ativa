const is32ByteBuffer = (value) => Buffer.isBuffer(value) && value.length === 32;

module.exports = (sequelize, DataTypes) => {
  const AuthSession = sequelize.define('AuthSession', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    family_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: 'auth_sessions_family_id_key',
    },
    refresh_token_hash: {
      type: DataTypes.BLOB,
      allowNull: false,
      unique: 'auth_sessions_refresh_token_hash_key',
      validate: {
        is32Bytes(value) {
          if (!is32ByteBuffer(value)) {
            throw new Error('refresh_token_hash must be a 32-byte Buffer');
          }
        },
      },
    },
    previous_refresh_token_hash: {
      type: DataTypes.BLOB,
      allowNull: true,
      validate: {
        is32BytesOrNull(value) {
          if (value !== null && value !== undefined && !is32ByteBuffer(value)) {
            throw new Error('previous_refresh_token_hash must be a 32-byte Buffer');
          }
        },
      },
    },
    rotation_counter: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    rotated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    previous_valid_until: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    absolute_expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    revoked_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    revoked_reason: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
  }, {
    tableName: 'auth_sessions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: 'auth_sessions_user_id_idx',
        fields: ['user_id'],
      },
      {
        name: 'auth_sessions_expires_at_id_idx',
        fields: ['expires_at', 'id'],
      },
    ],
    validate: {
      expirationOrder() {
        if (
          this.expires_at &&
          this.absolute_expires_at &&
          this.expires_at > this.absolute_expires_at
        ) {
          throw new Error('expires_at must not exceed absolute_expires_at');
        }
      },
    },
  });

  AuthSession.associate = (models) => {
    AuthSession.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  };

  return AuthSession;
};
