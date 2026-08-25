const webPush = require('web-push');

const REQUIRED_VAPID_VARIABLES = [
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
];
const SEND_TIMEOUT_MS = 2500;
const PAYLOAD_TTL_SECONDS = 60;
const MAX_PAYLOAD_BYTES = 4096;

const readVapidConfig = (env) => {
  const values = {};

  for (const name of REQUIRED_VAPID_VARIABLES) {
    if (typeof env[name] !== 'string' || env[name].trim().length === 0) {
      return null;
    }
    values[name] = env[name].trim();
  }

  return {
    subject: values.VAPID_SUBJECT,
    publicKey: values.VAPID_PUBLIC_KEY,
    privateKey: values.VAPID_PRIVATE_KEY,
  };
};

const classifyWebPushError = (error) => {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : null;

  if (statusCode === 404 || statusCode === 410) {
    return { ok: false, statusCode, reason: 'expired' };
  }
  if (statusCode === 429) {
    return { ok: false, statusCode, reason: 'rate_limited' };
  }
  if (statusCode >= 500 && statusCode <= 599) {
    return { ok: false, statusCode, reason: 'provider_error' };
  }
  if (statusCode === 401 || statusCode === 403) {
    return { ok: false, statusCode, reason: 'configuration_error' };
  }

  return { ok: false, statusCode, reason: 'delivery_error' };
};

const normalizeSubscription = ({ endpoint, p256dh, auth } = {}) => {
  if (
    typeof endpoint !== 'string'
    || endpoint.trim().length === 0
    || typeof p256dh !== 'string'
    || p256dh.trim().length === 0
    || typeof auth !== 'string'
    || auth.trim().length === 0
  ) {
    return null;
  }

  return {
    endpoint,
    keys: { p256dh, auth },
  };
};

const serializePayload = (payload) => {
  try {
    const serialized = JSON.stringify(payload);
    if (
      typeof serialized !== 'string'
      || Buffer.byteLength(serialized, 'utf8') > MAX_PAYLOAD_BYTES
    ) {
      return null;
    }
    return serialized;
  } catch (error) {
    return null;
  }
};

const createWebPushProvider = ({
  webPushClient = webPush,
  env = process.env,
  logger = console,
} = {}) => {
  const publicKey = typeof env.VAPID_PUBLIC_KEY === 'string'
    && env.VAPID_PUBLIC_KEY.trim().length > 0
    ? env.VAPID_PUBLIC_KEY.trim()
    : null;
  const vapidConfig = readVapidConfig(env);
  let configured = false;

  if (vapidConfig) {
    try {
      webPushClient.setVapidDetails(
        vapidConfig.subject,
        vapidConfig.publicKey,
        vapidConfig.privateKey
      );
      configured = true;
    } catch (error) {
      logger.error?.('web push VAPID configuration error');
    }
  }

  const isConfigured = () => configured;
  const getPublicKey = () => publicKey;

  const send = async ({ endpoint, p256dh, auth, payload } = {}) => {
    if (!configured) {
      return { ok: false, statusCode: null, reason: 'configuration_error' };
    }

    const subscription = normalizeSubscription({ endpoint, p256dh, auth });
    const serializedPayload = serializePayload(payload);

    if (!subscription || serializedPayload === null) {
      return { ok: false, statusCode: null, reason: 'delivery_error' };
    }

    try {
      await webPushClient.sendNotification(subscription, serializedPayload, {
        TTL: PAYLOAD_TTL_SECONDS,
        timeout: SEND_TIMEOUT_MS,
      });
      return { ok: true };
    } catch (error) {
      const result = classifyWebPushError(error);
      logger.warn?.('web push delivery failed', {
        statusCode: result.statusCode,
        reason: result.reason,
      });
      return result;
    }
  };

  return { isConfigured, getPublicKey, send };
};

module.exports = {
  ...createWebPushProvider(),
  createWebPushProvider,
  classifyWebPushError,
};
