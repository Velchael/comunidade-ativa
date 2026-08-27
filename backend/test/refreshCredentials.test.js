const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generateRefreshSecret,
  encodeSecret,
  buildRefreshCredential,
  parseRefreshCredential,
  hashRefreshSecret,
  safeHashEqual,
} = require('../src/utils/refreshCredentials');

const SESSION_ID = 'a6893c27-ea0c-4663-8ea1-80d0d9a38e18';

test('genera 32 bytes aleatorios y los codifica base64url en 43 caracteres', () => {
  const first = generateRefreshSecret();
  const second = generateRefreshSecret();
  assert.equal(first.length, 32);
  assert.equal(encodeSecret(first).length, 43);
  assert.match(encodeSecret(first), /^[A-Za-z0-9_-]{43}$/);
  assert.notDeepEqual(first, second);
});

test('construye y parsea estrictamente UUID.secret', () => {
  const secret = Buffer.alloc(32, 7);
  const credential = buildRefreshCredential(SESSION_ID, secret);
  assert.equal(credential.length, 80);
  assert.deepEqual(parseRefreshCredential(credential), { sessionId: SESSION_ID, secret });
});

test('rechaza UUID, alfabeto, longitud y separadores inválidos', () => {
  const encoded = encodeSecret(Buffer.alloc(32));
  assert.equal(parseRefreshCredential(`not-a-uuid.${encoded}`), null);
  assert.equal(parseRefreshCredential(`${SESSION_ID}.${encoded.slice(0, -1)}!`), null);
  assert.equal(parseRefreshCredential(`${SESSION_ID}.${encoded.slice(1)}`), null);
  assert.equal(parseRefreshCredential(`${SESSION_ID}.${encoded}.extra`), null);
  assert.equal(parseRefreshCredential(null), null);
});

test('SHA-256 devuelve Buffer binario de 32 bytes y comparación segura valida longitudes', () => {
  const hash = hashRefreshSecret(Buffer.alloc(32, 1));
  assert.equal(Buffer.isBuffer(hash), true);
  assert.equal(hash.length, 32);
  assert.equal(safeHashEqual(hash, Buffer.from(hash)), true);
  assert.equal(safeHashEqual(hash, Buffer.alloc(32, 2)), false);
  assert.equal(safeHashEqual(hash, Buffer.alloc(31)), false);
  assert.equal(safeHashEqual(hash, 'not-a-buffer'), false);
  assert.equal(safeHashEqual(hash, null), false);
  assert.equal(safeHashEqual(hash, undefined), false);
});
