const test = require('node:test');
const assert = require('node:assert/strict');
const { getAllowedOrigins, requireAuthOrigin } = require('../src/middleware/authOrigin');

const withEnv = (values, callback) => {
  const original = {};
  for (const [key, value] of Object.entries(values)) {
    original[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try { return callback(); } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

const invoke = (origin) => {
  const result = { next: false, status: null, body: null };
  const req = { get: (name) => name === 'origin' ? origin : undefined };
  const res = {
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; },
  };
  requireAuthOrigin(req, res, () => { result.next = true; });
  return result;
};

test('producción acepta exactamente comuva.com', () => withEnv({ NODE_ENV: 'production' }, () => {
  assert.equal(invoke('https://comuva.com').next, true);
  for (const origin of ['https://evil.com', 'https://sub.comuva.com', 'https://comuva.com.evil.test', 'null', undefined]) {
    const result = invoke(origin);
    assert.equal(result.status, 403);
    assert.equal(result.body.error.code, 'AUTH_ORIGIN_INVALID');
  }
}));

test('desarrollo permite solo localhost configurado/conocido', () => withEnv({
  NODE_ENV: 'development', FRONTEND_URL: 'http://127.0.0.1:3000'
}, () => {
  assert.deepEqual([...getAllowedOrigins()].sort(), [
    'http://127.0.0.1:3000', 'http://localhost:3001'
  ]);
  assert.equal(invoke('http://localhost:3001').next, true);
  assert.equal(invoke('http://127.0.0.1:3000').next, true);
  assert.equal(invoke('http://evil.localhost:3001').status, 403);
  assert.equal(invoke(undefined).status, 403);
}));

test('FRONTEND_URL remota no amplía allowlist de desarrollo', () => withEnv({
  NODE_ENV: 'development', FRONTEND_URL: 'https://staging.example.com'
}, () => assert.equal(getAllowedOrigins().has('https://staging.example.com'), false)));
