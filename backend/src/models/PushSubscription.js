module.exports = (sequelize, DataTypes) => {
  const PushSubscription = sequelize.define('PushSubscription', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    endpoint: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: 'push_subscriptions_endpoint_key',
    },
    p256dh: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    auth: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  }, {
    tableName: 'push_subscriptions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return PushSubscription;
};
