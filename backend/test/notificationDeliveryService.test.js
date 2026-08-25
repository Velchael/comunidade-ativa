process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createNotificationDeliveryService,
  MAX_SUBSCRIPTIONS_PER_DELIVERY,
} = require('../src/services/notificationDeliveryService');

const NOTIFICACION = {
  id: 40,
  user_id: 88,
  actor_user_id: 42,
  tipo: 'respuesta_interaccion',
  interaccion_id: 15,
  respuesta_id: 30,
  mensaje: 'contenido que nunca debe enviarse',
};
const SECRET_ENDPOINT = 'https://push.example.test/private-endpoint';
const SECRET_P256DH = 'private-p256dh';
const SECRET_AUTH = 'private-auth';

const makeSubscription = (id) => ({
  id,
  endpoint: `${SECRET_ENDPOINT}-${id}`,
  p256dh: `${SECRET_P256DH}-${id}`,
  auth: `${SECRET_AUTH}-${id}`,
});

const createHarness = ({
  configured = true,
  subscriptions = [makeSubscription(1)],
  results = [{ ok: true }],
  actor = { id: 42, username: 'Efraim', email: 'secret@example.test' },
  actorError = null,
  subscriptionsError = null,
  destroyError = null,
  sendErrorAt = null,
} = {}) => {
  const calls = [];
  let sendIndex = 0;
  const logger = {
    info: (...args) => calls.push(['logger:info', ...args]),
    warn: (...args) => calls.push(['logger:warn', ...args]),
    error: (...args) => calls.push(['logger:error', ...args]),
  };
  const User = {
    findByPk: async (...args) => {
      calls.push(['user:findByPk', ...args]);
      if (actorError) throw actorError;
      return actor;
    },
  };
  const PushSubscription = {
    findAll: async (options) => {
      calls.push(['subscription:findAll', options]);
      if (subscriptionsError) throw subscriptionsError;
      return subscriptions;
    },
    destroy: async (options) => {
      calls.push(['subscription:destroy', options]);
      if (destroyError) throw destroyError;
      return 1;
    },
  };
  const provider = {
    isConfigured: () => configured,
    send: async (input) => {
      const index = sendIndex;
      sendIndex += 1;
      calls.push(['provider:send', input]);
      if (sendErrorAt === index) {
        throw new Error(`${SECRET_ENDPOINT} ${SECRET_AUTH}`);
      }
      return results[index] || { ok: false, statusCode: null, reason: 'delivery_error' };
    },
  };
  const service = createNotificationDeliveryService({
    PushSubscription,
    User,
    provider,
    logger,
  });

  return { calls, service };
};

const ZERO_SUMMARY = { attempted: 0, delivered: 0, expired: 0, failed: 0 };

test('sin notificación no consulta ni entrega', async () => {
  const harness = createHarness();
  assert.deepEqual(await harness.service.deliver(null), ZERO_SUMMARY);
  assert.deepEqual(harness.calls, []);
});

test('provider no configurado no altera Nivel 1 ni consulta RDS', async () => {
  const harness = createHarness({ configured: false });
  assert.deepEqual(await harness.service.deliver(NOTIFICACION), ZERO_SUMMARY);
  assert.equal(harness.calls.some(([name]) => name === 'user:findByPk'), false);
  assert.equal(harness.calls.some(([name]) => name === 'subscription:findAll'), false);
});

test('sin subscriptions devuelve attempted 0 sin warning', async () => {
  const harness = createHarness({ subscriptions: [] });
  assert.deepEqual(await harness.service.deliver(NOTIFICACION), ZERO_SUMMARY);
  assert.equal(harness.calls.some(([name]) => name === 'user:findByPk'), false);
  assert.equal(harness.calls.some(([name]) => name === 'logger:warn'), false);
});

test('una subscription exitosa devuelve resumen correcto', async () => {
  const harness = createHarness();
  assert.deepEqual(await harness.service.deliver(NOTIFICACION), {
    attempted: 1,
    delivered: 1,
    expired: 0,
    failed: 0,
  });
});

test('múltiples subscriptions se envían una vez por dispositivo', async () => {
  const harness = createHarness({
    subscriptions: [makeSubscription(1), makeSubscription(2), makeSubscription(3)],
    results: [{ ok: true }, { ok: true }, { ok: true }],
  });
  const summary = await harness.service.deliver(NOTIFICACION);

  assert.equal(harness.calls.filter(([name]) => name === 'provider:send').length, 3);
  assert.deepEqual(summary, { attempted: 3, delivered: 3, expired: 0, failed: 0 });
});

test('actor se consulta únicamente con id y username', async () => {
  const harness = createHarness();
  await harness.service.deliver(NOTIFICACION);

  assert.deepEqual(harness.calls.find(([name]) => name === 'user:findByPk'), [
    'user:findByPk',
    42,
    { attributes: ['id', 'username'] },
  ]);
});

test('payload es exacto y no contiene mensaje ni datos sensibles', async () => {
  const harness = createHarness();
  await harness.service.deliver(NOTIFICACION);
  const payload = harness.calls.find(([name]) => name === 'provider:send')[1].payload;

  assert.deepEqual(payload, {
    notification_id: 40,
    tipo: 'respuesta_interaccion',
    interaccion_id: 15,
    actor_username: 'Efraim',
  });
  assert.equal(Object.hasOwn(payload, 'mensaje'), false);
  assert.equal(JSON.stringify(payload).includes('secret@example.test'), false);
});

test('query de subscriptions usa destinatario, atributos mínimos, orden y límite', async () => {
  const harness = createHarness();
  await harness.service.deliver(NOTIFICACION);

  assert.deepEqual(harness.calls.find(([name]) => name === 'subscription:findAll')[1], {
    where: { user_id: 88 },
    attributes: ['id', 'endpoint', 'p256dh', 'auth'],
    order: [['updated_at', 'DESC'], ['id', 'DESC']],
    limit: MAX_SUBSCRIPTIONS_PER_DELIVERY,
  });
});

for (const statusCode of [404, 410]) {
  test(`${statusCode} elimina únicamente la subscription expirada y propia`, async () => {
    const harness = createHarness({
      results: [{ ok: false, statusCode, reason: 'expired' }],
    });
    const summary = await harness.service.deliver(NOTIFICACION);

    assert.deepEqual(harness.calls.find(([name]) => name === 'subscription:destroy')[1], {
      where: { id: 1, user_id: 88 },
    });
    assert.deepEqual(summary, { attempted: 1, delivered: 0, expired: 1, failed: 0 });
  });
}

for (const [statusCode, reason] of [
  [429, 'rate_limited'],
  [500, 'provider_error'],
  [503, 'provider_error'],
  [401, 'configuration_error'],
  [403, 'configuration_error'],
]) {
  test(`${statusCode}/${reason} no elimina subscription`, async () => {
    const harness = createHarness({
      results: [{ ok: false, statusCode, reason }],
    });
    const summary = await harness.service.deliver(NOTIFICACION);

    assert.equal(harness.calls.some(([name]) => name === 'subscription:destroy'), false);
    assert.deepEqual(summary, { attempted: 1, delivered: 0, expired: 0, failed: 1 });
  });
}

test('fallo en un dispositivo no detiene los demás', async () => {
  const harness = createHarness({
    subscriptions: [makeSubscription(1), makeSubscription(2), makeSubscription(3)],
    results: [{ ok: true }, { ok: true }, { ok: true }],
    sendErrorAt: 1,
  });
  const summary = await harness.service.deliver(NOTIFICACION);

  assert.equal(harness.calls.filter(([name]) => name === 'provider:send').length, 3);
  assert.deepEqual(summary, { attempted: 3, delivered: 2, expired: 0, failed: 1 });
});

test('resumen mixto cuenta delivered, expired y failed', async () => {
  const harness = createHarness({
    subscriptions: [makeSubscription(1), makeSubscription(2), makeSubscription(3)],
    results: [
      { ok: true },
      { ok: false, statusCode: 410, reason: 'expired' },
      { ok: false, statusCode: 429, reason: 'rate_limited' },
    ],
  });

  assert.deepEqual(await harness.service.deliver(NOTIFICACION), {
    attempted: 3,
    delivered: 1,
    expired: 1,
    failed: 1,
  });
});

test('logs nunca contienen endpoint, keys, payload ni error interno', async () => {
  const harness = createHarness({ sendErrorAt: 0 });
  await harness.service.deliver(NOTIFICACION);
  const logs = JSON.stringify(harness.calls.filter(([name]) => name.startsWith('logger:')));

  for (const secret of [SECRET_ENDPOINT, SECRET_P256DH, SECRET_AUTH, NOTIFICACION.mensaje]) {
    assert.equal(logs.includes(secret), false);
  }
});

test('error inesperado de actor queda capturado y no hace throw', async () => {
  const harness = createHarness({ actorError: new Error(`${SECRET_AUTH} actor DB failed`) });
  await assert.doesNotReject(() => harness.service.deliver(NOTIFICACION));
  assert.deepEqual(await harness.service.deliver(NOTIFICACION), ZERO_SUMMARY);
});

test('error inesperado de subscriptions queda capturado y no hace throw', async () => {
  const harness = createHarness({ subscriptionsError: new Error('RDS failed') });
  await assert.doesNotReject(() => harness.service.deliver(NOTIFICACION));
});

test('fallo al limpiar expirada no detiene resumen ni propaga excepción', async () => {
  const harness = createHarness({
    results: [{ ok: false, statusCode: 410, reason: 'expired' }],
    destroyError: new Error('cleanup failed'),
  });

  let summary;
  await assert.doesNotReject(async () => {
    summary = await harness.service.deliver(NOTIFICACION);
  });
  assert.deepEqual(summary, {
    attempted: 1,
    delivered: 0,
    expired: 1,
    failed: 0,
  });
});
