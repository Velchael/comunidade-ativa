import fs from 'fs';
import path from 'path';

jest.mock('axios', () => ({}));

import {
  activatePushNotifications,
  deactivatePushNotifications,
  getPushAvailability,
  getPushState,
  isPushSupported,
  urlBase64ToUint8Array
} from './pushNotifications';

const TOKEN = 'test-token';
const ENDPOINT = 'https://push.example.test/subscription';

const createEnvironment = ({
  permission = 'default',
  requestPermission = jest.fn().mockResolvedValue('granted'),
  registration = null,
  ios = false,
  standalone = true
} = {}) => {
  const serviceWorker = {
    getRegistration: jest.fn().mockResolvedValue(registration),
    register: jest.fn()
  };
  const navigatorObj = {
    serviceWorker,
    platform: ios ? 'iPhone' : 'Linux x86_64',
    userAgent: ios ? 'Mozilla/5.0 (iPhone)' : 'Mozilla/5.0',
    maxTouchPoints: ios ? 5 : 0,
    standalone
  };
  const windowObj = {
    PushManager: function PushManager() {},
    Notification: { permission, requestPermission },
    matchMedia: jest.fn().mockReturnValue({ matches: standalone })
  };

  return { navigatorObj, serviceWorker, windowObj };
};

const createSubscription = () => ({
  endpoint: ENDPOINT,
  toJSON: jest.fn().mockReturnValue({
    endpoint: ENDPOINT,
    keys: { p256dh: 'public-key', auth: 'auth-key' }
  }),
  unsubscribe: jest.fn().mockResolvedValue(true)
});

const createRegistration = (subscription = null) => ({
  pushManager: {
    getSubscription: jest.fn().mockResolvedValue(subscription),
    subscribe: jest.fn()
  }
});

test('detecta navegador sem soporte push', () => {
  expect(isPushSupported({ windowObj: {}, navigatorObj: {} })).toBe(false);
  expect(getPushAvailability({ windowObj: {}, navigatorObj: {} })).toBe('unsupported');
});

test.each([
  ['default', 'default'],
  ['denied', 'denied']
])('refleja permission %s sin solicitar permiso', async (permission, expected) => {
  const registration = createRegistration();
  const environment = createEnvironment({ permission, registration });

  await expect(getPushState(environment)).resolves.toBe(expected);
  expect(environment.windowObj.Notification.requestPermission).not.toHaveBeenCalled();
});

test('subscription existente prevalece y refleja granted/active', async () => {
  const registration = createRegistration(createSubscription());
  const environment = createEnvironment({ permission: 'granted', registration });

  await expect(getPushState(environment)).resolves.toBe('active');
});

test('iOS fuera de standalone no solicita permiso', async () => {
  const environment = createEnvironment({ ios: true, standalone: false });

  expect(getPushAvailability(environment)).toBe('ios_not_standalone');
  await expect(activatePushNotifications({ token: TOKEN, ...environment })).resolves.toEqual({
    status: 'ios_not_standalone'
  });
  expect(environment.windowObj.Notification.requestPermission).not.toHaveBeenCalled();
});

test('permission denied detiene activación antes de consultar VAPID', async () => {
  const registration = createRegistration();
  const environment = createEnvironment({
    registration,
    requestPermission: jest.fn().mockResolvedValue('denied')
  });
  const client = { get: jest.fn() };

  await expect(activatePushNotifications({ token: TOKEN, client, ...environment })).resolves.toEqual({
    status: 'denied'
  });
  expect(client.get).not.toHaveBeenCalled();
});

test('permission granted continúa el flujo únicamente tras la acción de activar', async () => {
  const subscription = createSubscription();
  const registration = createRegistration(subscription);
  const requestPermission = jest.fn().mockResolvedValue('granted');
  const environment = createEnvironment({ registration, requestPermission });
  const client = {
    get: jest.fn().mockResolvedValue({ data: { publicKey: 'AQIDBA' } }),
    post: jest.fn().mockResolvedValue({ data: { subscribed: true } })
  };

  await expect(activatePushNotifications({ token: TOKEN, client, ...environment })).resolves.toEqual({
    status: 'active'
  });
  expect(requestPermission).toHaveBeenCalledTimes(1);
  expect(client.get).toHaveBeenCalledTimes(1);
});

test('registra Service Worker al activar si todavía no existe', async () => {
  const subscription = createSubscription();
  const registration = createRegistration(subscription);
  const environment = createEnvironment({ registration: null });
  environment.serviceWorker.register.mockResolvedValue(registration);
  const client = {
    get: jest.fn().mockResolvedValue({ data: { publicKey: 'AQIDBA' } }),
    post: jest.fn().mockResolvedValue({ data: { subscribed: true } })
  };

  await activatePushNotifications({ token: TOKEN, client, ...environment });

  expect(environment.serviceWorker.register).toHaveBeenCalledWith('/service-worker.js', {
    scope: '/'
  });
});

test('reutiliza subscription existente y hace POST autenticado correcto', async () => {
  const subscription = createSubscription();
  const registration = createRegistration(subscription);
  const environment = createEnvironment({ registration });
  const client = {
    get: jest.fn().mockResolvedValue({ data: { publicKey: 'AQIDBA' } }),
    post: jest.fn().mockResolvedValue({ data: { subscribed: true } })
  };

  await expect(activatePushNotifications({ token: TOKEN, client, ...environment })).resolves.toEqual({
    status: 'active'
  });
  expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
  expect(client.post).toHaveBeenCalledWith(
    expect.stringMatching(/\/api\/push\/subscriptions$/),
    {
      endpoint: ENDPOINT,
      keys: { p256dh: 'public-key', auth: 'auth-key' }
    },
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
});

test('crea subscription nueva con VAPID pública convertida', async () => {
  const subscription = createSubscription();
  const registration = createRegistration();
  registration.pushManager.subscribe.mockResolvedValue(subscription);
  const environment = createEnvironment({ registration });
  const client = {
    get: jest.fn().mockResolvedValue({ data: { publicKey: 'AQIDBA' } }),
    post: jest.fn().mockResolvedValue({ data: { subscribed: true } })
  };

  await activatePushNotifications({ token: TOKEN, client, ...environment });

  expect(registration.pushManager.subscribe).toHaveBeenCalledWith({
    userVisibleOnly: true,
    applicationServerKey: new Uint8Array([1, 2, 3, 4])
  });
});

test('DELETE backend ocurre antes de unsubscribe local', async () => {
  const order = [];
  const subscription = createSubscription();
  subscription.unsubscribe.mockImplementation(async () => {
    order.push('unsubscribe');
    return true;
  });
  const registration = createRegistration(subscription);
  const environment = createEnvironment({ registration });
  const client = {
    delete: jest.fn().mockImplementation(async () => {
      order.push('delete');
      return { data: { subscribed: false } };
    })
  };

  await expect(deactivatePushNotifications({ token: TOKEN, client, ...environment })).resolves.toEqual({
    status: 'default'
  });
  expect(order).toEqual(['delete', 'unsubscribe']);
  expect(client.delete).toHaveBeenCalledWith(
    expect.stringMatching(/\/api\/push\/subscriptions$/),
    {
      headers: { Authorization: `Bearer ${TOKEN}` },
      data: { endpoint: ENDPOINT }
    }
  );
});

test('si DELETE falla no finge desactivación ni hace unsubscribe', async () => {
  const subscription = createSubscription();
  const registration = createRegistration(subscription);
  const environment = createEnvironment({ registration });
  const client = { delete: jest.fn().mockRejectedValue(new Error('backend failed')) };

  await expect(deactivatePushNotifications({ token: TOKEN, client, ...environment })).rejects.toThrow();
  expect(subscription.unsubscribe).not.toHaveBeenCalled();
});

test('convierte VAPID base64url a Uint8Array', () => {
  expect(urlBase64ToUint8Array('AQIDBA')).toEqual(new Uint8Array([1, 2, 3, 4]));
});

test('helper no utiliza localStorage ni sessionStorage', () => {
  const source = fs.readFileSync(path.join(__dirname, 'pushNotifications.js'), 'utf8');
  expect(source).not.toMatch(/localStorage|sessionStorage/);
});

test('Service Worker solo maneja push/click, usa fallback y URL same-origin', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'public', 'service-worker.js'),
    'utf8'
  );

  expect(source).toContain("addEventListener('push'");
  expect(source).toContain("addEventListener('notificationclick'");
  expect(source).not.toContain("addEventListener('fetch'");
  expect(source).toContain('Você recebeu uma nova notificação');
  expect(source).toContain("new URL('/interacciones', self.location.origin)");
  expect(source).not.toMatch(/payload\.(url|href|target)/);
});

test('index registra /service-worker.js sin solicitar permisos', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'src', 'index.js'), 'utf8');

  expect(source).toContain("'serviceWorker' in navigator");
  expect(source).toContain("register('/service-worker.js', { scope: '/' })");
  expect(source).not.toContain('Notification.requestPermission');
});
