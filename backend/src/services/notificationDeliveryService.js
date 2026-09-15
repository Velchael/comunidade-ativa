const { Op } = require('sequelize');
const db = require('../models');
const webPushProvider = require('./webPushProvider');

const MAX_SUBSCRIPTIONS_PER_DELIVERY = 10;
const AGENDA_NOTIFICATION_TYPES = new Set([
  'agenda_task_created',
  'agenda_task_updated',
  'agenda_task_cancelled',
  'agenda_task_deleted',
]);
const PRIVATE_MESSAGE_NOTIFICATION_TYPE = 'mensagem_privada';

const emptySummary = () => ({
  attempted: 0,
  delivered: 0,
  expired: 0,
  failed: 0,
});

const normalizeId = (value) => {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
};

const createNotificationDeliveryService = ({
  PushSubscription = db.PushSubscription,
  User = db.User,
  provider = webPushProvider,
  logger = console,
  maxSubscriptions = MAX_SUBSCRIPTIONS_PER_DELIVERY,
} = {}) => {
  const buildPayload = async (notificacion) => {
    if (notificacion.tipo === 'respuesta_interaccion') {
      const actor = await User.findByPk(notificacion.actor_user_id, {
        attributes: ['id', 'username'],
      });

      return {
        notification_id: notificacion.id,
        tipo: 'respuesta_interaccion',
        interaccion_id: notificacion.interaccion_id,
        actor_username: actor?.username || 'Alguém',
      };
    }

    if (AGENDA_NOTIFICATION_TYPES.has(notificacion.tipo)) {
      return {
        notification_id: notificacion.id,
        tipo: notificacion.tipo,
        type: notificacion.tipo,
        title: notificacion.titulo,
        body: notificacion.corpo,
        url: notificacion.url,
        taskId: notificacion.task_id,
        comunidadId: notificacion.comunidad_id,
      };
    }

    if (notificacion.tipo === PRIVATE_MESSAGE_NOTIFICATION_TYPE) {
      return {
        notification_id: notificacion.id,
        tipo: PRIVATE_MESSAGE_NOTIFICATION_TYPE,
        type: PRIVATE_MESSAGE_NOTIFICATION_TYPE,
        title: notificacion.titulo,
        body: notificacion.corpo,
        url: notificacion.url,
        comunidadId: notificacion.comunidad_id,
      };
    }

    return null;
  };

  const deliverMany = async (notificaciones = []) => {
    const summary = emptySummary();
    const items = Array.isArray(notificaciones) ? notificaciones.filter(Boolean) : [];

    if (items.length === 0) return summary;

    try {
      if (!provider.isConfigured()) return summary;

      const userIds = [];

      for (const notificacion of items) {
        const userId = normalizeId(notificacion.user_id);
        if (!userId) continue;

        userIds.push(userId);
      }

      const uniqueUserIds = [...new Set(userIds)];
      if (uniqueUserIds.length === 0) return summary;

      const singleUserId = uniqueUserIds.length === 1 ? uniqueUserIds[0] : null;
      const subscriptions = await PushSubscription.findAll({
        where: singleUserId
          ? { user_id: singleUserId }
          : { user_id: { [Op.in]: uniqueUserIds } },
        attributes: singleUserId
          ? ['id', 'endpoint', 'p256dh', 'auth']
          : ['id', 'user_id', 'endpoint', 'p256dh', 'auth'],
        order: singleUserId
          ? [['updated_at', 'DESC'], ['id', 'DESC']]
          : [['user_id', 'ASC'], ['updated_at', 'DESC'], ['id', 'DESC']],
        ...(singleUserId ? { limit: maxSubscriptions } : {}),
      });

      if (subscriptions.length === 0) return summary;

      const subscribedUserIds = new Set(
        subscriptions
          .map((subscription) => normalizeId(subscription.user_id) || singleUserId)
          .filter(Boolean)
      );
      const payloadsByUserId = new Map();

      for (const notificacion of items) {
        const userId = normalizeId(notificacion.user_id);
        if (!userId || !subscribedUserIds.has(userId)) continue;

        const payload = await buildPayload(notificacion);
        if (payload) payloadsByUserId.set(userId, payload);
      }

      if (payloadsByUserId.size === 0) return summary;

      const results = await Promise.all(subscriptions.map(async (subscription) => {
        const userId = normalizeId(subscription.user_id) || singleUserId;
        const payload = payloadsByUserId.get(userId);

        if (!payload) return 'failed';

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
                  user_id: userId,
                },
              });
            } catch (error) {
              logger.error?.('expired push subscription cleanup failed', {
                notificationId: payload.notification_id,
              });
            }
            return 'expired';
          }

          logger.warn?.('web push delivery result', {
            notificationId: payload.notification_id,
            statusCode: result.statusCode,
            reason: result.reason,
          });
          return 'failed';
        } catch (error) {
          logger.error?.('web push device delivery failed', {
            notificationId: payload.notification_id,
          });
          return 'failed';
        }
      }));

      summary.attempted = results.length;
      for (const result of results) {
        summary[result] += 1;
      }

      logger.info?.('web push delivery completed', {
        notificationIds: items.map((notificacion) => notificacion.id).filter(Boolean),
        ...summary,
      });
      return summary;
    } catch (error) {
      logger.error?.('notification delivery failed', {
        notificationIds: items.map((notificacion) => notificacion.id).filter(Boolean),
      });
      return summary;
    }
  };

  const deliver = async (notificacion) => deliverMany(notificacion ? [notificacion] : []);

  return { deliver, deliverMany };
};

module.exports = {
  ...createNotificationDeliveryService(),
  createNotificationDeliveryService,
  MAX_SUBSCRIPTIONS_PER_DELIVERY,
};
