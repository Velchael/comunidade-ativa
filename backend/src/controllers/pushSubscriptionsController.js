const db = require('../models');

const MAX_LENGTHS = Object.freeze({
  endpoint: 4096,
  p256dh: 512,
  auth: 256,
});

const isNonEmptyStringWithinLimit = (value, maxLength) => (
  typeof value === 'string'
  && value.trim().length > 0
  && value.length <= maxLength
);

const validateSubscriptionBody = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  const { endpoint, keys } = body;
  if (!keys || typeof keys !== 'object' || Array.isArray(keys)) {
    return null;
  }

  if (
    !isNonEmptyStringWithinLimit(endpoint, MAX_LENGTHS.endpoint)
    || !isNonEmptyStringWithinLimit(keys.p256dh, MAX_LENGTHS.p256dh)
    || !isNonEmptyStringWithinLimit(keys.auth, MAX_LENGTHS.auth)
  ) {
    return null;
  }

  return {
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  };
};

const validateEndpointBody = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  if (!isNonEmptyStringWithinLimit(body.endpoint, MAX_LENGTHS.endpoint)) {
    return null;
  }

  return body.endpoint;
};

const createPushSubscriptionsController = ({
  PushSubscription = db.PushSubscription,
  logger = console,
} = {}) => {
  const subscribe = async (req, res) => {
    const subscription = validateSubscriptionBody(req.body);
    if (!subscription) {
      return res.status(400).json({ message: 'Push subscription inválida' });
    }

    try {
      const userId = req.user.id;

      await PushSubscription.upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      }, {
        conflictFields: ['endpoint'],
        returning: false,
      });

      return res.json({ subscribed: true });
    } catch (error) {
      logger.error?.('push subscription POST error');
      return res.status(500).json({ message: 'Erro ao guardar push subscription' });
    }
  };

  const unsubscribe = async (req, res) => {
    const endpoint = validateEndpointBody(req.body);
    if (!endpoint) {
      return res.status(400).json({ message: 'Endpoint inválido' });
    }

    try {
      await PushSubscription.destroy({
        where: {
          user_id: req.user.id,
          endpoint,
        },
      });

      return res.json({ subscribed: false });
    } catch (error) {
      logger.error?.('push subscription DELETE error');
      return res.status(500).json({ message: 'Erro ao eliminar push subscription' });
    }
  };

  return { subscribe, unsubscribe };
};

module.exports = {
  ...createPushSubscriptionsController(),
  createPushSubscriptionsController,
  MAX_LENGTHS,
  validateSubscriptionBody,
  validateEndpointBody,
};
