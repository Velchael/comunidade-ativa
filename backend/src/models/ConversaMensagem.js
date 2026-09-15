module.exports = (sequelize, DataTypes) => {
  const ConversaMensagem = sequelize.define('ConversaMensagem', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    conversa_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    sender_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    corpo: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    read_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'conversa_mensagens',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        fields: ['conversa_id', 'id'],
      },
    ],
  });

  ConversaMensagem.associate = (models) => {
    ConversaMensagem.belongsTo(models.ConversaPrivada, {
      foreignKey: 'conversa_id',
      as: 'conversa',
    });

    ConversaMensagem.belongsTo(models.User, {
      foreignKey: 'sender_user_id',
      as: 'sender',
    });
  };

  return ConversaMensagem;
};
