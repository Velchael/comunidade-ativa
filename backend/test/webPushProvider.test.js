const test = require('node:test');
const assert = require('node:assert/strict');

const providerModule = require('../src/services/webPushProvider');
const { createWebPushProvider } = providerModule;

const SECRET_ENDPOINT = 'https://push.example.test/secret-endpoint';
const SECRET_P256DH = 'secret-p256dh';
const SECRET_AUTH = 'secret-auth';
const SECRET_PRIVATE_KEY = 'secret-private-key';
const CONFIGURED_ENV = {
  VAPID_PUBLIC_KEY: 'public-key',
  VAPID_PRIVATE_KEY: SECRET_PRIVATE_KEY,
  VAPID_SUBJECT: 'https://comuva.com',
};

const createHarness = ({ env = CONFIGURED_ENV, sendError = null } = {}) => {
  const calls = [];
  const webPushClient = {
    setVapidDetails(...args) {
      calls.push(['setVapidDetails', ...args]);
    },
    async sendNotification(...args) {
      calls.push(['sendNotification', ...args]);
      if (sendError) throw sendError;
      return { statusCode: 201 };
    },
  };
  const logger = {
    error: (...args) => calls.push(['logger:error', ...args]),
    warn: (...args) => calls.push(['logger:warn', ...args]),
  };
  const provider = createWebPushProvider({ webPushClient, env, logger });

  return { calls, provider };
};

const validSendInput = (payload = { notification_id: 10, tipo: 'test' }) => ({
  endpoint: SECRET_ENDPOINT,
  p256dh: SECRET_P256DH,
  auth: SECRET_AUTH,
  payload,
});

test('queda configurado cuando existen las tres variables VAPID', () => {
  const { calls, provider } = createHarness();

  assert.equal(provider.isConfigured(), true);
  assert.equal(provider.getPublicKey(), 'public-key');
  assert.deepEqual(calls[0], [
    'setVapidDetails',
    'https://comuva.com',
    'public-key',
    SECRET_PRIVATE_KEY,
  ]);
});

for (const missingVariable of Object.keys(CONFIGURED_ENV)) {
  test(`no queda configurado si falta ${missingVariable}`, () => {
    const env = { ...CONFIGURED_ENV };
    delete env[missingVariable];
    const { calls, provider } = createHarness({ env });

    assert.equal(provider.isConfigured(), false);
    assert.equal(calls.some(([name]) => name === 'setVapidDetails'), false);
  });
}

test('send no intenta entrega si VAPID no está configurado', async () => {
  const { calls, provider } = createHarness({ env: {} });
  const result = await provider.send(validSendInput());

  assert.deepEqual(result, {
    ok: false,
    statusCode: null,
    reason: 'configuration_error',
  });
  assert.equal(calls.some(([name]) => name === 'sendNotification'), false);
});

test('transforma subscription al contrato esperado por web-push', async () => {
  const { calls, provider } = createHarness();
  await provider.send(validSendInput());

  assert.deepEqual(calls.find(([name]) => name === 'sendNotification')[1], {
    endpoint: SECRET_ENDPOINT,
    keys: { p256dh: SECRET_P256DH, auth: SECRET_AUTH },
  });
});

test('serializa payload JSON pequeño y aplica TTL y timeout', async () => {
  const { calls, provider } = createHarness();
  const payload = { notification_id: 10, tipo: 'test' };
  await provider.send(validSendInput(payload));

  const sendCall = calls.find(([name]) => name === 'sendNotification');
  assert.equal(sendCall[2], JSON.stringify(payload));
  assert.deepEqual(sendCall[3], { TTL: 60, timeout: 2500 });
});

test('éxito devuelve únicamente { ok: true }', async () => {
  const { provider } = createHarness();
  assert.deepEqual(await provider.send(validSendInput()), { ok: true });
});

for (const [statusCode, reason] of [
  [404, 'expired'],
  [410, 'expired'],
  [429, 'rate_limited'],
  [500, 'provider_error'],
  [503, 'provider_error'],
  [401, 'configuration_error'],
  [403, 'configuration_error'],
]) {
  test(`${statusCode} se clasifica como ${reason}`, async () => {
    const { provider } = createHarness({ sendError: { statusCode } });
    assert.deepEqual(await provider.send(validSendInput()), {
      ok: false,
      statusCode,
      reason,
    });
  });
}

test('error desconocido se clasifica como delivery_error', async () => {
  const { provider } = createHarness({ sendError: new Error('unknown') });
  assert.deepEqual(await provider.send(validSendInput()), {
    ok: false,
    statusCode: null,
    reason: 'delivery_error',
  });
});

test('respuesta de error no propaga endpoint ni keys', async () => {
  const { provider } = createHarness({ sendError: { statusCode: 410 } });
  const serialized = JSON.stringify(await provider.send(validSendInput()));

  assert.equal(serialized.includes(SECRET_ENDPOINT), false);
  assert.equal(serialized.includes(SECRET_P256DH), false);
  assert.equal(serialized.includes(SECRET_AUTH), false);
});

test('logs no contienen endpoint, keys, private key ni payload', async () => {
  const payload = { actor_username: 'private-user-data' };
  const { calls, provider } = createHarness({
    sendError: new Error(`${SECRET_ENDPOINT} ${SECRET_P256DH} ${SECRET_AUTH}`),
  });
  await provider.send(validSendInput(payload));

  const logs = JSON.stringify(calls.filter(([name]) => name.startsWith('logger:')));
  for (const secret of [
    SECRET_ENDPOINT,
    SECRET_P256DH,
    SECRET_AUTH,
    SECRET_PRIVATE_KEY,
    payload.actor_username,
  ]) {
    assert.equal(logs.includes(secret), false);
  }
});

test('private key nunca se exporta ni queda accesible en provider', () => {
  const { provider } = createHarness();

  assert.equal(Object.hasOwn(providerModule, 'VAPID_PRIVATE_KEY'), false);
  assert.equal(Object.hasOwn(providerModule, 'readVapidConfig'), false);
  assert.equal(JSON.stringify(Object.keys(providerModule)).includes(SECRET_PRIVATE_KEY), false);
  assert.equal(JSON.stringify(Object.keys(provider)).includes(SECRET_PRIVATE_KEY), false);
  assert.equal(provider.getPublicKey(), 'public-key');
});

test('crear y consultar provider no ejecuta sendNotification', () => {
  const { calls, provider } = createHarness();

  assert.equal(provider.isConfigured(), true);
  assert.equal(provider.getPublicKey(), 'public-key');
  assert.equal(calls.some(([name]) => name === 'sendNotification'), false);
});

test('configuración VAPID inválida no impide crear el provider', () => {
  const calls = [];
  const provider = createWebPushProvider({
    env: CONFIGURED_ENV,
    logger: { error: (...args) => calls.push(args) },
    webPushClient: {
      setVapidDetails() { throw new Error(`invalid ${SECRET_PRIVATE_KEY}`); },
      sendNotification() { throw new Error('must not run'); },
    },
  });

  assert.equal(provider.isConfigured(), false);
  assert.deepEqual(calls, [['web push VAPID configuration error']]);
});

test('payload excesivo o no serializable no intenta entrega', async () => {
  const { calls, provider } = createHarness();
  const circular = {};
  circular.self = circular;

  assert.deepEqual(await provider.send(validSendInput({ value: 'x'.repeat(4096) })), {
    ok: false,
    statusCode: null,
    reason: 'delivery_error',
  });
  assert.deepEqual(await provider.send(validSendInput(circular)), {
    ok: false,
    statusCode: null,
    reason: 'delivery_error',
  });
  assert.equal(calls.some(([name]) => name === 'sendNotification'), false);
});
