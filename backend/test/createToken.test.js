const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const createToken = require('../src/utils/createToken');

test('createAccessToken dura 15 minutos sin cambiar default legacy', () => {
  const original = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'create-token-test-secret';
  try {
    const access = jwt.decode(createToken.createAccessToken({ id: 1 }));
    const legacy = jwt.decode(createToken({ id: 1 }));
    assert.equal(access.exp - access.iat, 900);
    assert.equal(access.token_use, 'access');
    assert.equal(legacy.exp - legacy.iat, 7200);
    assert.equal(legacy.token_use, undefined);
  } finally {
    if (original === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original;
  }
});
