const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { verificarToken } = require('../src/middleware/authMiddleware');

const invoke = (authorization) => {
  const result = { status: null, body: null, next: false, user: null };
  const req = { headers: { authorization } };
  const res = {
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; },
  };
  verificarToken(req, res, () => { result.next = true; result.user = req.user; });
  return result;
};

test('authMiddleware conserva mensaje legacy y añade códigos diferenciados', () => {
  const original = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'middleware-test-secret';
  try {
    const missing = invoke('');
    assert.equal(missing.status, 401);
    assert.equal(missing.body.message, 'Token não fornecido');
    assert.equal(missing.body.error.code, 'AUTH_ACCESS_MISSING');

    const invalid = invoke('Bearer invalid');
    assert.equal(invalid.status, 401);
    assert.equal(invalid.body.message, 'Token inválido ou expirado');
    assert.equal(invalid.body.error.code, 'AUTH_ACCESS_INVALID');

    const expiredToken = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: -1 });
    assert.equal(invoke(`Bearer ${expiredToken}`).body.error.code, 'AUTH_ACCESS_EXPIRED');

    const validToken = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: 60 });
    const valid = invoke(`Bearer ${validToken}`);
    assert.equal(valid.next, true);
    assert.equal(valid.user.id, 1);
  } finally {
    if (original === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original;
  }
});
