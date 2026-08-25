const db = require('../models');
const webPushProvider = require('./webPushProvider');

const MAX_SUBSCRIPTIONS_PER_DELIVERY = 10;

const emptySummary = () => ({
  attempted: 0,
  delivered: 0,
  expired: 0,
  failed: 0,
});

const createNotificationDeliveryService = ({
  PushSubscription = db.PushSubscription,
  User = db.User,
  provider = webPushProvider,
  logger = console,
  maxSubscriptions = MAX_SUBSCRIPTIONS_PER_DELIVERY,
} = {}) => {
  const deliver = async (notificacion) => {
    const summary = emptySummary();

    if (!notificacion) return summary;

    try {
      if (!provider.isConfigured()) return summary;

      const subscriptions = await PushSubscription.findAll({
        where: { user_id: notificacion.user_id },
        attributes: ['id', 'endpoint', 'p256dh', 'auth'],
        order: [['updated_at', 'DESC'], ['id', 'DESC']],
        limit: maxSubscriptions,
      });

      if (subscriptions.length === 0) return summary;

      const actor = await User.findByPk(notificacion.actor_user_id, {
        attributes: ['id', 'username'],
      });

      const payload = {
        notification_id: notificacion.id,
        tipo: 'respuesta_interaccion',
        interaccion_id: notificacion.interaccion_id,
        actor_username: actor?.username || 'Alguém',
      };

      const results = await Promise.all(subscriptions.map(async (subscription) => {
        try {
          const result = await provider.send({
            endpoint: subscription.endpoint,
            p256dh: subscription.p256dh,
            auth: subscription.auth,
            payload,
          });

          if (result.ok) return 'delivered';

          if (result.reason === 'expired') {
            try {
              await PushSubscription.destroy({
                where: {
                  id: subscription.id,
                  user_id: notificacion.user_id,
                },
              });
            } catch (error) {
              logger.error?.('expired push subscription cleanup failed', {
                notificationId: notificacion.id,
              });
            }
            return 'expired';
          }

          logger.warn?.('web push delivery result', {
            notificationId: notificacion.id,
            statusCode: result.statusCode,
            reason: result.reason,
          });
          return 'failed';
        } catch (error) {
          logger.error?.('web push device delivery failed', {
            notificationId: notificacion.id,
          });
          return 'failed';
        }
      }));

      summary.attempted = results.length;
      for (const result of results) {
        summary[result] += 1;
      }

      logger.info?.('web push delivery completed', {
        notificationId: notificacion.id,
        ...summary,
      });
      return summary;
    } catch (error) {
      logger.error?.('notification delivery failed', {
        notificationId: notificacion.id,
      });
      return summary;
    }
  };

  return { deliver };
};

module.exports = {
  ...createNotificationDeliveryService(),
  createNotificationDeliveryService,
  MAX_SUBSCRIPTIONS_PER_DELIVERY,
};
