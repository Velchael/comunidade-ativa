module.exports = (sequelize, DataTypes) => {
  const ConversaPrivada = sequelize.define('ConversaPrivada', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    comunidad_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    participante_1_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    participante_2_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    origin_interaccion_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    last_message_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'conversas_privadas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['comunidad_id', 'participante_1_id', 'participante_2_id'],
      },
      {
        fields: ['participante_1_id', { name: 'last_message_at', order: 'DESC' }],
      },
      {
        fields: ['participante_2_id', { name: 'last_message_at', order: 'DESC' }],
      },
    ],
  });

  ConversaPrivada.associate = (models) => {
    ConversaPrivada.belongsTo(models.Comunidad, {
      foreignKey: 'comunidad_id',
      as: 'comunidad',
    });

    ConversaPrivada.belongsTo(models.User, {
      foreignKey: 'participante_1_id',
      as: 'participante1',
    });

    ConversaPrivada.belongsTo(models.User, {
      foreignKey: 'participante_2_id',
      as: 'participante2',
    });

    ConversaPrivada.hasMany(models.ConversaMensagem, {
      foreignKey: 'conversa_id',
      as: 'mensagens',
    });
  };

  return ConversaPrivada;
};
