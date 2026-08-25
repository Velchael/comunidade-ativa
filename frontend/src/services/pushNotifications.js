import axios from 'axios';

const API_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:3000') + '/api';

export const isPushSupported = ({
  windowObj = window,
  navigatorObj = navigator
} = {}) => Boolean(
  navigatorObj
  && 'serviceWorker' in navigatorObj
  && windowObj
  && 'PushManager' in windowObj
  && 'Notification' in windowObj
);

export const isIosDevice = ({ windowObj = window, navigatorObj = navigator } = {}) => {
  const platform = navigatorObj?.platform || '';
  const userAgent = navigatorObj?.userAgent || '';
  const touchPoints = Number(navigatorObj?.maxTouchPoints || 0);

  return /iPhone|iPad|iPod/i.test(userAgent)
    || /iPhone|iPad|iPod/i.test(platform)
    || (platform === 'MacIntel' && touchPoints > 1 && 'ontouchend' in windowObj);
};

export const isStandalone = ({ windowObj = window, navigatorObj = navigator } = {}) => Boolean(
  windowObj?.matchMedia?.('(display-mode: standalone)').matches
  || navigatorObj?.standalone === true
);

export const getPushAvailability = (environment = {}) => {
  if (!isPushSupported(environment)) return 'unsupported';
  if (isIosDevice(environment) && !isStandalone(environment)) return 'ios_not_standalone';
  return 'ready';
};

export const urlBase64ToUint8Array = (base64String) => {
  if (typeof base64String !== 'string' || !base64String.trim()) {
    throw new Error('Invalid VAPID public key');
  }

  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);

  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
};

const getRegistration = async ({ navigatorObj, registerIfMissing }) => {
  let registration = await navigatorObj.serviceWorker.getRegistration('/');

  if (!registration && registerIfMissing) {
    registration = await navigatorObj.serviceWorker.register('/service-worker.js', {
      scope: '/'
    });
  }

  return registration;
};

export const getPushState = async ({
  windowObj = window,
  navigatorObj = navigator
} = {}) => {
  const availability = getPushAvailability({ windowObj, navigatorObj });
  if (availability !== 'ready') return availability;

  const registration = await getRegistration({ navigatorObj, registerIfMissing: false });
  const subscription = registration
    ? await registration.pushManager.getSubscription()
    : null;

  if (subscription) return 'active';
  if (windowObj.Notification.permission === 'denied') return 'denied';
  return 'default';
};

export const activatePushNotifications = async ({
  token,
  client = axios,
  windowObj = window,
  navigatorObj = navigator
}) => {
  const availability = getPushAvailability({ windowObj, navigatorObj });
  if (availability !== 'ready') return { status: availability };

  const registration = await getRegistration({ navigatorObj, registerIfMissing: true });
  const permission = await windowObj.Notification.requestPermission();

  if (permission !== 'granted') {
    return { status: permission === 'denied' ? 'denied' : 'default' };
  }

  const { data } = await client.get(`${API_BASE}/push/vapid-public-key`);
  const applicationServerKey = urlBase64ToUint8Array(data?.publicKey);
  let subscription = await registration.pushManager.getSubscription();
  const createdNow = !subscription;

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });
  }

  const serialized = subscription.toJSON();

  try {
    await client.post(`${API_BASE}/push/subscriptions`, {
      endpoint: serialized.endpoint,
      keys: {
        p256dh: serialized.keys?.p256dh,
        auth: serialized.keys?.auth
      }
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (error) {
    if (createdNow) {
      try {
        await subscription.unsubscribe();
      } catch (unsubscribeError) {
        // A próxima tentativa reutilizará ou corrigirá o estado local do navegador.
      }
    }
    throw error;
  }

  return { status: 'active' };
};

export const deactivatePushNotifications = async ({
  token,
  client = axios,
  windowObj = window,
  navigatorObj = navigator
}) => {
  if (!isPushSupported({ windowObj, navigatorObj })) {
    return { status: 'unsupported' };
  }

  const registration = await getRegistration({ navigatorObj, registerIfMissing: false });
  const subscription = registration
    ? await registration.pushManager.getSubscription()
    : null;

  if (!subscription) return { status: 'default' };

  await client.delete(`${API_BASE}/push/subscriptions`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { endpoint: subscription.endpoint }
  });

  const unsubscribed = await subscription.unsubscribe();
  if (!unsubscribed) throw new Error('Browser subscription could not be removed');

  return { status: 'default' };
};
