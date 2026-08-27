const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AuthCookieError,
  REFRESH_COOKIE_NAME,
  buildRefreshCookieOptions,
  setRefreshCookie,
  clearRefreshCookie,
} = require('../src/utils/authCookies');

const now = new Date('2026-08-26T00:00:00.000Z');

const withNodeEnv = (value, callback) => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = value;
  try {
    return callback();
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
};

test('cookie de producción es host-only, HttpOnly, Secure, Lax y usa path auth', () => {
  const options = buildRefreshCookieOptions({
    now,
    session: {
      expires_at: new Date(now.getTime() + 20_000),
      absolute_expires_at: new Date(now.getTime() + 10_000),
    },
  });
  assert.deepEqual(options, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 10_000,
  });
  assert.equal('domain' in options, false);
});

test('producción fuerza Secure aunque el caller solicite HTTP local', () => {
  withNodeEnv('production', () => {
    const options = buildRefreshCookieOptions({
      now,
      isLocalHttp: true,
      session: { expires_at: new Date(now.getTime() + 1), absolute_expires_at: new Date(now.getTime() + 1) },
    });
    assert.equal(options.secure, true);
  });
});

test('solo desarrollo HTTP local puede desactivar Secure y fecha vencida da Max-Age cero', () => {
  withNodeEnv('development', () => {
    const options = buildRefreshCookieOptions({
      now,
      isLocalHttp: true,
      session: { expires_at: new Date(0), absolute_expires_at: new Date(0) },
    });
    assert.equal(options.secure, false);
    assert.equal(options.maxAge, 0);
  });
});

test('rechaza now, expires_at y absolute_expires_at inválidos antes de emitir cookie', () => {
  const validSession = {
    expires_at: new Date(now.getTime() + 1),
    absolute_expires_at: new Date(now.getTime() + 2),
  };
  assert.throws(
    () => buildRefreshCookieOptions({ now: new Date(NaN), session: validSession }),
    (error) => error instanceof AuthCookieError && error.code === 'AUTH_COOKIE_INVALID_NOW'
  );
  assert.throws(
    () => buildRefreshCookieOptions({ now, session: { ...validSession, expires_at: new Date(NaN) } }),
    (error) => error.code === 'AUTH_COOKIE_INVALID_EXPIRES_AT'
  );
  assert.throws(
    () => buildRefreshCookieOptions({ now, session: { ...validSession, absolute_expires_at: Infinity } }),
    (error) => error.code === 'AUTH_COOKIE_INVALID_ABSOLUTE_EXPIRES_AT'
  );
});

test('helpers set/clear usan el mismo nombre y scope, sin Domain', () => {
  const calls = [];
  const res = {
    cookie: (...args) => calls.push(['cookie', ...args]),
    clearCookie: (...args) => calls.push(['clearCookie', ...args]),
  };
  const session = {
    expires_at: new Date(now.getTime() + 5_000),
    absolute_expires_at: new Date(now.getTime() + 9_000),
  };
  withNodeEnv('development', () => {
    setRefreshCookie(res, 'credential', session, { now, isLocalHttp: true });
    clearRefreshCookie(res, { isLocalHttp: true });
  });
  assert.equal(calls[0][1], REFRESH_COOKIE_NAME);
  assert.equal(calls[0][2], 'credential');
  assert.equal(calls[0][3].maxAge, 5_000);
  assert.equal('domain' in calls[0][3], false);
  assert.deepEqual(calls[1], ['clearCookie', REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/api/auth',
  }]);
  assert.equal('domain' in calls[1][2], false);
});

test('clear cookie también fuerza Secure en producción', () => {
  const calls = [];
  const res = { clearCookie: (...args) => calls.push(args) };
  withNodeEnv('production', () => clearRefreshCookie(res, { isLocalHttp: true }));
  assert.equal(calls[0][1].secure, true);
});
