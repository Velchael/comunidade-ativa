process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize, DataTypes } = require('sequelize');
const {
  createPushSubscriptionsController,
  MAX_LENGTHS,
} = require('../src/controllers/pushSubscriptionsController');

const VALID_ENDPOINT = 'https://push.example.test/subscription/abc';
const VALID_P256DH = 'public-key';
const VALID_AUTH = 'auth-secret';

const createResponse = () => {
  const response = { statusCode: 200, body: null };
  const res = {
    status(code) {
      response.statusCode = code;
      return this;
    },
    json(body) {
      response.body = body;
      return this;
    },
  };

  return { response, res };
};

const createHarness = ({ upsertError = null, destroyError = null } = {}) => {
  const rows = new Map();
  const calls = [];
  const logger = { error: (...args) => calls.push(['logger:error', ...args]) };
  const PushSubscription = {
    async upsert(values, options) {
      calls.push(['upsert', values, options]);
      if (upsertError) throw upsertError;
      rows.set(values.endpoint, { ...values });
      return [rows.get(values.endpoint), true];
    },
    async destroy(options) {
      calls.push(['destroy', options]);
      if (destroyError) throw destroyError;
      const existing = rows.get(options.where.endpoint);
      if (existing && existing.user_id === options.where.user_id) {
        rows.delete(options.where.endpoint);
        return 1;
      }
      return 0;
    },
  };
  const controller = createPushSubscriptionsController({ PushSubscription, logger });
  const req = {
    user: { id: 42 },
    body: {
      endpoint: VALID_ENDPOINT,
      keys: { p256dh: VALID_P256DH, auth: VALID_AUTH },
    },
  };

  return { calls, controller, req, rows };
};

const callSubscribe = async (harness) => {
  const { response, res } = createResponse();
  await harness.controller.subscribe(harness.req, res);
  return response;
};

const callUnsubscribe = async (harness) => {
  const { response, res } = createResponse();
  await harness.controller.unsubscribe(harness.req, res);
  return response;
};

test('rutas POST y DELETE están protegidas por verificarToken', () => {
  const router = require('../src/routes/push');
  const subscriptionRoutes = router.stack.filter((layer) => layer.route?.path === '/subscriptions');

  assert.equal(subscriptionRoutes.length, 2);
  for (const layer of subscriptionRoutes) {
    assert.equal(layer.route.stack[0].name, 'verificarToken');
  }
});

test('modelo PushSubscription coincide con tabla y timestamps explícitos', () => {
  const sequelize = new Sequelize('postgresql://test:test@127.0.0.1:5432/test', { logging: false });
  const model = require('../src/models/PushSubscription')(sequelize, DataTypes);

  assert.equal(model.tableName, 'push_subscriptions');
  assert.equal(model.options.timestamps, true);
  assert.equal(model._timestampAttributes.createdAt, 'created_at');
  assert.equal(model._timestampAttributes.updatedAt, 'updated_at');
  assert.equal(model.rawAttributes.endpoint.type.key, 'TEXT');
});

test('POST usa req.user.id e ignora body.user_id', async () => {
  const harness = createHarness();
  harness.req.body.user_id = 999;
  await callSubscribe(harness);

  assert.equal(harness.calls.find(([name]) => name === 'upsert')[1].user_id, 42);
});

test('subscription válida se guarda y devuelve contrato mínimo', async () => {
  const harness = createHarness();
  const response = await callSubscribe(harness);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { subscribed: true });
  assert.deepEqual(harness.rows.get(VALID_ENDPOINT), {
    user_id: 42,
    endpoint: VALID_ENDPOINT,
    p256dh: VALID_P256DH,
    auth: VALID_AUTH,
  });
});

for (const [name, mutate] of [
  ['endpoint vacío', (body) => { body.endpoint = '   '; }],
  ['p256dh vacío', (body) => { body.keys.p256dh = ''; }],
  ['auth vacío', (body) => { body.keys.auth = ' '; }],
]) {
  test(`POST rechaza ${name}`, async () => {
    const harness = createHarness();
    mutate(harness.req.body);
    const response = await callSubscribe(harness);

    assert.equal(response.statusCode, 400);
    assert.equal(harness.calls.some(([callName]) => callName === 'upsert'), false);
  });
}

for (const malformedBody of [null, [], {}, { endpoint: VALID_ENDPOINT }, {
  endpoint: VALID_ENDPOINT,
  keys: [],
}]) {
  test(`POST rechaza payload malformado: ${JSON.stringify(malformedBody)}`, async () => {
    const harness = createHarness();
    harness.req.body = malformedBody;
    const response = await callSubscribe(harness);
    assert.equal(response.statusCode, 400);
  });
}

for (const [field, length] of Object.entries(MAX_LENGTHS)) {
  test(`POST rechaza ${field} excesivo`, async () => {
    const harness = createHarness();
    if (field === 'endpoint') harness.req.body.endpoint = 'x'.repeat(length + 1);
    else harness.req.body.keys[field] = 'x'.repeat(length + 1);

    const response = await callSubscribe(harness);
    assert.equal(response.statusCode, 400);
    assert.equal(harness.calls.some(([name]) => name === 'upsert'), false);
  });
}

test('endpoint repetido no duplica y actualiza keys', async () => {
  const harness = createHarness();
  await callSubscribe(harness);
  harness.req.body.keys = { p256dh: 'new-public-key', auth: 'new-auth' };
  await callSubscribe(harness);

  assert.equal(harness.rows.size, 1);
  assert.equal(harness.rows.get(VALID_ENDPOINT).p256dh, 'new-public-key');
  assert.equal(harness.rows.get(VALID_ENDPOINT).auth, 'new-auth');
  assert.deepEqual(harness.calls.find(([name]) => name === 'upsert')[2], {
    conflictFields: ['endpoint'],
    returning: false,
  });
});

test('mismo endpoint se reasigna al usuario autenticado', async () => {
  const harness = createHarness();
  await callSubscribe(harness);
  harness.req.user.id = 77;
  harness.req.body.user_id = 42;
  await callSubscribe(harness);

  assert.equal(harness.rows.size, 1);
  assert.equal(harness.rows.get(VALID_ENDPOINT).user_id, 77);
});

test('múltiples endpoints diferentes pertenecen al mismo usuario', async () => {
  const harness = createHarness();
  await callSubscribe(harness);
  harness.req.body.endpoint = `${VALID_ENDPOINT}-second`;
  await callSubscribe(harness);

  assert.equal(harness.rows.size, 2);
  assert.equal([...harness.rows.values()].every((row) => row.user_id === 42), true);
});

test('requests simultáneos usan upsert sobre el conflicto de endpoint', async () => {
  const harness = createHarness();
  await Promise.all([callSubscribe(harness), callSubscribe(harness)]);

  assert.equal(harness.rows.size, 1);
  assert.equal(harness.calls.filter(([name]) => name === 'upsert').length, 2);
  assert.equal(harness.calls.filter(([name]) => name === 'upsert').every((call) => (
    call[2].conflictFields[0] === 'endpoint'
  )), true);
});

test('DELETE elimina únicamente la subscription propia', async () => {
  const harness = createHarness();
  await callSubscribe(harness);
  const response = await callUnsubscribe(harness);

  assert.deepEqual(harness.calls.find(([name]) => name === 'destroy')[1].where, {
    user_id: 42,
    endpoint: VALID_ENDPOINT,
  });
  assert.equal(harness.rows.size, 0);
  assert.deepEqual(response.body, { subscribed: false });
});

test('DELETE no elimina subscription de otro usuario', async () => {
  const harness = createHarness();
  harness.rows.set(VALID_ENDPOINT, { user_id: 77, endpoint: VALID_ENDPOINT });
  const response = await callUnsubscribe(harness);

  assert.equal(response.statusCode, 200);
  assert.equal(harness.rows.size, 1);
  assert.deepEqual(response.body, { subscribed: false });
});

test('DELETE inexistente es idempotente', async () => {
  const harness = createHarness();
  const response = await callUnsubscribe(harness);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { subscribed: false });
});

test('DELETE rechaza endpoint inválido', async () => {
  const harness = createHarness();
  harness.req.body = { endpoint: '' };
  const response = await callUnsubscribe(harness);

  assert.equal(response.statusCode, 400);
  assert.equal(harness.calls.some(([name]) => name === 'destroy'), false);
});

test('respuestas API nunca exponen endpoint, p256dh ni auth', async () => {
  const harness = createHarness();
  const postResponse = await callSubscribe(harness);
  const deleteResponse = await callUnsubscribe(harness);

  const serialized = JSON.stringify([postResponse.body, deleteResponse.body]);
  assert.equal(serialized.includes(VALID_ENDPOINT), false);
  assert.equal(serialized.includes(VALID_P256DH), false);
  assert.equal(serialized.includes(VALID_AUTH), false);
  assert.deepEqual(postResponse.body, { subscribed: true });
  assert.deepEqual(deleteResponse.body, { subscribed: false });
});

test('error POST responde 500 seguro y no registra datos sensibles', async () => {
  const harness = createHarness({ upsertError: new Error(`DB failure ${VALID_ENDPOINT} ${VALID_AUTH}`) });
  const response = await callSubscribe(harness);
  const logged = JSON.stringify(harness.calls.filter(([name]) => name === 'logger:error'));

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { message: 'Erro ao guardar push subscription' });
  assert.equal(JSON.stringify(response.body).includes(VALID_ENDPOINT), false);
  assert.equal(logged.includes(VALID_ENDPOINT), false);
  assert.equal(logged.includes(VALID_P256DH), false);
  assert.equal(logged.includes(VALID_AUTH), false);
});

test('error DELETE responde 500 seguro y no registra endpoint', async () => {
  const harness = createHarness({ destroyError: new Error(`DB failure ${VALID_ENDPOINT}`) });
  const response = await callUnsubscribe(harness);
  const logged = JSON.stringify(harness.calls.filter(([name]) => name === 'logger:error'));

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { message: 'Erro ao eliminar push subscription' });
  assert.equal(JSON.stringify(response.body).includes(VALID_ENDPOINT), false);
  assert.equal(logged.includes(VALID_ENDPOINT), false);
});
