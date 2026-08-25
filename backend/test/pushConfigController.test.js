const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPushConfigController,
} = require('../src/controllers/pushConfigController');

const PUBLIC_KEY = 'public-vapid-key';
const PRIVATE_KEY = 'private-vapid-key';

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

test('GET devuelve 200 y exclusivamente publicKey cuando existe', () => {
  const controller = createPushConfigController({
    provider: { getPublicKey: () => PUBLIC_KEY },
  });
  const { response, res } = createResponse();

  controller.getVapidPublicKey({}, res);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { publicKey: PUBLIC_KEY });
  assert.deepEqual(Object.keys(response.body), ['publicKey']);
});

test('respuesta nunca devuelve privateKey, VAPID_PRIVATE_KEY ni datos de subscription', () => {
  const controller = createPushConfigController({
    provider: { getPublicKey: () => PUBLIC_KEY },
  });
  const { response, res } = createResponse();

  controller.getVapidPublicKey({}, res);
  const serialized = JSON.stringify(response.body);

  for (const forbidden of [
    'privateKey',
    'VAPID_PRIVATE_KEY',
    PRIVATE_KEY,
    'auth',
    'endpoint',
    'p256dh',
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test('sin public key devuelve 503 seguro', () => {
  const controller = createPushConfigController({
    provider: { getPublicKey: () => null },
  });
  const { response, res } = createResponse();

  controller.getVapidPublicKey({}, res);

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, {
    message: 'Push notifications are not configured',
  });
});

test('private key no aparece en logs ante un error', () => {
  const logs = [];
  const controller = createPushConfigController({
    provider: {
      getPublicKey() {
        throw new Error(`configuration failed: ${PRIVATE_KEY}`);
      },
    },
    logger: { error: (...args) => logs.push(args) },
  });
  const { response, res } = createResponse();

  controller.getVapidPublicKey({}, res);

  assert.equal(response.statusCode, 500);
  assert.equal(JSON.stringify(logs).includes(PRIVATE_KEY), false);
  assert.deepEqual(logs, [['VAPID public key read error']]);
});

test('GET /vapid-public-key es público y no incluye verificarToken', () => {
  process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';
  const router = require('../src/routes/push');
  const layer = router.stack.find((item) => item.route?.path === '/vapid-public-key');

  assert.ok(layer);
  assert.equal(layer.route.methods.get, true);
  assert.equal(layer.route.stack.length, 1);
  assert.equal(layer.route.stack.some(({ name }) => name === 'verificarToken'), false);
});
