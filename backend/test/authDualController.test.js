const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const controllerPath = require.resolve('../src/controllers/authController');
const modelsPath = require.resolve('../src/models');
const servicePath = require.resolve('../src/services/authSessionService');
const responsePath = require.resolve('../src/utils/buildAuthUserResponse');
const cookiesPath = require.resolve('../src/utils/authCookies');
const tokenPath = require.resolve('../src/utils/createToken');

const SESSION = {
  id: 'session-id', user_id: 10,
  expires_at: new Date(Date.now() + 60_000),
  absolute_expires_at: new Date(Date.now() + 120_000),
};
const USER = {
  id: 10, email: 'user@example.invalid', rol: 'miembro', rol_global: 'miembro',
  username: 'lab', googleId: null, comunidad_id: null,
};

const makeResponse = () => {
  const state = { status: 200, body: undefined, sent: false, cookies: [], redirects: [] };
  return {
    state,
    headersSent: false,
    status(code) { state.status = code; return this; },
    json(body) { state.body = body; return this; },
    send() { state.sent = true; return this; },
    cookie(name, credential, options) { state.cookies.push({ name, credential, options }); return this; },
    redirect(location) { state.redirects.push(location); return this; },
  };
};

const makeRequest = ({ cookie, authorization } = {}) => ({
  headers: { cookie: cookie || '', authorization: authorization || '' },
  protocol: 'https', hostname: 'comuva.com',
});

const loadHarness = ({
  service = {},
  findByPk = async () => USER,
  buildResponse = async (user) => ({ id: user.id, authoritative: true }),
  transaction,
  buildCookieOptions,
} = {}) => {
  class AuthSessionError extends Error {
    constructor(code) { super(code); this.code = code; }
  }
  const calls = { set: [], clear: [], events: [], find: [], create: [], cookieOptions: [] };
  const activeTransaction = { id: 'transaction-id' };
  const sequelize = {
    transaction: transaction || (async (callback) => {
      calls.events.push('begin');
      const result = await callback(activeTransaction);
      calls.events.push('commit');
      return result;
    }),
  };
  const completeService = {
    rotateSessionCredential: async () => ({ session: SESSION, credential: 'rotated-secret' }),
    revokeSession: async () => ({ result: 'REVOKED' }),
    createSession: async (args) => {
      calls.events.push('create');
      calls.create.push(args);
      return { session: SESSION, credential: 'created-secret' };
    },
    ...service,
  };
  const User = { findByPk: async (...args) => { calls.find.push(args); return findByPk(...args); } };
  const mock = (path, exports) => { require.cache[path] = { id: path, filename: path, loaded: true, exports }; };
  delete require.cache[controllerPath];
  mock(modelsPath, { User, Comunidad: {}, AuthSession: {}, sequelize });
  mock(servicePath, {
    ACCESS_TOKEN_TTL_SECONDS: 900, AuthSessionError,
    createAuthSessionService: () => completeService,
  });
  mock(responsePath, { buildAuthUserResponse: buildResponse });
  mock(cookiesPath, {
    REFRESH_COOKIE_NAME: 'comuva_refresh',
    buildRefreshCookieOptions: (args) => {
      calls.events.push('options');
      calls.cookieOptions.push(args);
      if (buildCookieOptions) return buildCookieOptions(args);
      return {
        httpOnly: true, secure: true, sameSite: 'lax', path: '/api/auth', maxAge: 60_000,
      };
    },
    setRefreshCookie: (_res, credential) => { calls.events.push('set'); calls.set.push(credential); },
    clearRefreshCookie: () => { calls.events.push('clear'); calls.clear.push(true); },
  });
  const fakeCreateToken = () => 'legacy-token';
  fakeCreateToken.createAccessToken = () => 'access-token-15m';
  mock(tokenPath, fakeCreateToken);
  const controller = require(controllerPath);
  return { controller, calls, AuthSessionError, service: completeService, activeTransaction };
};

test('Google callback rechaza usuario inválido sin sesión, cookie ni redirect', async () => {
  const harness = loadHarness();
  const res = makeResponse();
  await harness.controller.googleCallback(makeRequest(), res);
  assert.equal(res.state.status, 401);
  assert.equal(harness.calls.create.length, 0);
  assert.equal(res.state.cookies.length, 0);
  assert.equal(res.state.redirects.length, 0);
});

test('Google callback crea sesión transaccional, emite cookie después del commit y redirige limpio', async () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = 'https://app.comuva.test/base?ignored=yes';
  try {
    const harness = loadHarness();
    const res = makeResponse();
    res.cookie = function cookie(name, credential, options) {
      harness.calls.events.push('cookie');
      this.state.cookies.push({ name, credential, options });
      return this;
    };
    res.redirect = function redirect(location) {
      harness.calls.events.push('redirect');
      this.state.redirects.push(location);
      return this;
    };

    await harness.controller.googleCallback({ ...makeRequest(), user: USER }, res);

    assert.deepEqual(harness.calls.events, ['begin', 'create', 'options', 'commit', 'cookie', 'redirect']);
    assert.equal(harness.calls.create.length, 1);
    assert.equal(harness.calls.create[0].userId, USER.id);
    assert.equal(harness.calls.create[0].transaction, harness.activeTransaction);
    assert.deepEqual(res.state.cookies, [{
      name: 'comuva_refresh', credential: 'created-secret',
      options: { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/auth', maxAge: 60_000 },
    }]);
    assert.equal(Object.hasOwn(res.state.cookies[0].options, 'domain'), false);
    assert.deepEqual(res.state.redirects, ['https://app.comuva.test/seinscrever']);
    const location = res.state.redirects[0];
    for (const forbidden of ['token=', 'legacy-token', 'created-secret', USER.email, String(USER.id), 'googleId']) {
      assert.equal(location.includes(forbidden), false, forbidden);
    }
  } finally {
    if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = originalFrontendUrl;
  }
});

test('Google callback usa cookie no segura sólo para HTTP local en development', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFrontendUrl = process.env.FRONTEND_URL;
  process.env.NODE_ENV = 'development';
  process.env.FRONTEND_URL = 'http://localhost:3000';
  try {
    const harness = loadHarness({
      buildCookieOptions: ({ isLocalHttp }) => ({
        httpOnly: true, secure: !isLocalHttp, sameSite: 'lax', path: '/api/auth', maxAge: 60_000,
      }),
    });
    const res = makeResponse();
    const req = { ...makeRequest(), user: USER, protocol: 'http', hostname: 'localhost' };
    await harness.controller.googleCallback(req, res);
    assert.equal(harness.calls.cookieOptions[0].isLocalHttp, true);
    assert.equal(res.state.cookies[0].options.secure, false);
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = originalFrontendUrl;
  }
});

test('Google callback no emite cookie ni redirect si createSession u opciones fallan', async () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = 'https://app.comuva.test';
  try {
    for (const harness of [
      loadHarness({ service: { createSession: async () => { throw new Error('insert failed'); } } }),
      loadHarness({ buildCookieOptions: () => { throw new Error('invalid expiry'); } }),
    ]) {
      const res = makeResponse();
      await harness.controller.googleCallback({ ...makeRequest(), user: USER }, res);
      assert.equal(res.state.status, 500);
      assert.equal(res.state.cookies.length, 0);
      assert.equal(res.state.redirects.length, 0);
    }
  } finally {
    if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = originalFrontendUrl;
  }
});

test('Google callback no emite credencial si transaction/commit falla', async () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = 'https://app.comuva.test';
  try {
    let harness;
    harness = loadHarness({ transaction: async (callback) => {
      harness.calls.events.push('begin');
      await callback(harness.activeTransaction);
      harness.calls.events.push('commit-failed');
      throw new Error('commit failed');
    } });
    const res = makeResponse();
    await harness.controller.googleCallback({ ...makeRequest(), user: USER }, res);
    assert.deepEqual(harness.calls.events, ['begin', 'create', 'options', 'commit-failed']);
    assert.equal(res.state.status, 500);
    assert.equal(res.state.cookies.length, 0);
    assert.equal(res.state.redirects.length, 0);
  } finally {
    if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = originalFrontendUrl;
  }
});

test('Google callback maneja fallos síncronos post-commit sin filtrar credencial', async () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;
  const originalConsoleError = console.error;
  process.env.FRONTEND_URL = 'https://app.comuva.test';
  const logs = [];
  console.error = (...args) => { logs.push(args.join(' ')); };
  try {
    const cookieHarness = loadHarness();
    const cookieRes = makeResponse();
    cookieRes.cookie = () => { throw new Error('created-secret'); };
    await cookieHarness.controller.googleCallback({ ...makeRequest(), user: USER }, cookieRes);
    assert.equal(cookieRes.state.status, 500);
    assert.equal(cookieRes.state.redirects.length, 0);

    const redirectHarness = loadHarness();
    const redirectRes = makeResponse();
    redirectRes.redirect = () => { throw new Error('created-secret'); };
    await redirectHarness.controller.googleCallback({ ...makeRequest(), user: USER }, redirectRes);
    assert.equal(redirectRes.state.status, 500);
    assert.equal(redirectRes.state.cookies.length, 1);

    assert.equal(logs.join(' ').includes('created-secret'), false);
    assert.equal(JSON.stringify(cookieRes.state.body).includes('created-secret'), false);
    assert.equal(JSON.stringify(redirectRes.state.body).includes('created-secret'), false);
  } finally {
    console.error = originalConsoleError;
    if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = originalFrontendUrl;
  }
});

test('cada Google callback exitoso crea una sesión independiente', async () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = 'https://app.comuva.test';
  try {
    const harness = loadHarness();
    await harness.controller.googleCallback({ ...makeRequest(), user: USER }, makeResponse());
    await harness.controller.googleCallback({ ...makeRequest(), user: USER }, makeResponse());
    assert.equal(harness.calls.create.length, 2);
    assert.deepEqual(harness.calls.create.map(({ userId }) => userId), [USER.id, USER.id]);
  } finally {
    if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = originalFrontendUrl;
  }
});

test('POST refresh rota, reconstruye usuario, emite cookie y JSON sin refresh secret', async () => {
  const harness = loadHarness({ service: {
    rotateSessionCredential: async () => { harness.calls.events.push('rotated'); return { session: SESSION, credential: 'secret-only-cookie' }; }
  }});
  const res = makeResponse();
  await harness.controller.refreshSession(makeRequest({ cookie: 'x=1; comuva_refresh=credential' }), res);
  assert.equal(res.state.status, 200);
  assert.deepEqual(res.state.body, {
    access_token: 'access-token-15m', token_type: 'Bearer', expires_in: 900,
    user: { id: 10, authoritative: true },
  });
  assert.deepEqual(harness.calls.events, ['rotated', 'set']);
  assert.equal(harness.calls.set[0], 'secret-only-cookie');
  assert.equal(JSON.stringify(res.state.body).includes('secret-only-cookie'), false);
  assert.equal(harness.calls.find.length, 1);
});

test('POST refresh mapea missing/malformed/not-found/revoked/expired/invalid/reuse a 401 y limpia', async () => {
  for (const code of [
    'AUTH_REFRESH_MISSING', 'AUTH_REFRESH_MALFORMED', 'AUTH_SESSION_NOT_FOUND',
    'AUTH_SESSION_REVOKED', 'AUTH_SESSION_IDLE_EXPIRED', 'AUTH_SESSION_ABSOLUTE_EXPIRED',
    'AUTH_REFRESH_INVALID', 'AUTH_REFRESH_REUSE'
  ]) {
    let harness;
    harness = loadHarness({ service: { rotateSessionCredential: async () => { throw new harness.AuthSessionError(code); } } });
    const res = makeResponse();
    const request = code === 'AUTH_REFRESH_MISSING'
      ? makeRequest()
      : makeRequest({ cookie: 'comuva_refresh=value' });
    await harness.controller.refreshSession(request, res);
    assert.equal(res.state.status, 401, code);
    assert.equal(res.state.body.error.code, code);
    assert.equal(harness.calls.clear.length, 1);
  }
});

test('POST refresh race da 409 sin limpiar', async () => {
  let race;
  race = loadHarness({ service: { rotateSessionCredential: async () => { throw new race.AuthSessionError('AUTH_REFRESH_RACE'); } } });
  const raceRes = makeResponse();
  await race.controller.refreshSession(makeRequest({ cookie: 'comuva_refresh=value' }), raceRes);
  assert.equal(raceRes.state.status, 409);
  assert.equal(race.calls.clear.length, 0);
  assert.equal(race.calls.set.length, 0);

});

test('fallo temporal posterior al COMMIT emite B en 503 y nunca limpia ni reemite A', async () => {
  const harness = loadHarness({ findByPk: async () => { throw new Error('RDS timeout'); } });
  const res = makeResponse();
  await harness.controller.refreshSession(
    makeRequest({ cookie: 'comuva_refresh=credential-A' }),
    res
  );
  assert.equal(res.state.status, 503);
  assert.deepEqual(harness.calls.set, ['rotated-secret']);
  assert.equal(harness.calls.set.includes('credential-A'), false);
  assert.equal(harness.calls.clear.length, 0);
});

test('fallo temporal de buildAuthUserResponse después de COMMIT conserva B en 503', async () => {
  const harness = loadHarness({
    buildResponse: async () => { throw new Error('temporary photo signing failure'); }
  });
  const res = makeResponse();
  await harness.controller.refreshSession(
    makeRequest({ cookie: 'comuva_refresh=credential-A' }),
    res
  );
  assert.equal(res.state.status, 503);
  assert.deepEqual(harness.calls.set, ['rotated-secret']);
  assert.equal(harness.calls.clear.length, 0);
});

test('usuario inexistente revoca con B, limpia cookie y responde AUTH_USER_NOT_FOUND', async () => {
  const revokeCalls = [];
  const harness = loadHarness({
    findByPk: async () => null,
    service: { revokeSession: async (args) => { revokeCalls.push(args); } },
  });
  const res = makeResponse();
  await harness.controller.refreshSession(
    makeRequest({ cookie: 'comuva_refresh=credential-A' }),
    res
  );
  assert.equal(res.state.status, 401);
  assert.equal(res.state.body.error.code, 'AUTH_USER_NOT_FOUND');
  assert.deepEqual(revokeCalls, [{ credential: 'rotated-secret', reason: 'user_logout' }]);
  assert.equal(harness.calls.set.length, 0);
  assert.equal(harness.calls.clear.length, 1);
});

test('fallo temporal revocando usuario inexistente conserva B para reintentar terminación', async () => {
  const harness = loadHarness({
    findByPk: async () => null,
    service: { revokeSession: async () => { throw new Error('RDS unavailable'); } },
  });
  const res = makeResponse();
  await harness.controller.refreshSession(
    makeRequest({ cookie: 'comuva_refresh=credential-A' }),
    res
  );
  assert.equal(res.state.status, 503);
  assert.deepEqual(harness.calls.set, ['rotated-secret']);
  assert.equal(harness.calls.clear.length, 0);
});

test('race revocando usuario inexistente no finge terminación: conserva B y responde 503', async () => {
  let harness;
  harness = loadHarness({
    findByPk: async () => null,
    service: {
      revokeSession: async () => { throw new harness.AuthSessionError('AUTH_REFRESH_RACE'); }
    },
  });
  const res = makeResponse();
  await harness.controller.refreshSession(
    makeRequest({ cookie: 'comuva_refresh=credential-A' }),
    res
  );
  assert.equal(res.state.status, 503);
  assert.deepEqual(harness.calls.set, ['rotated-secret']);
  assert.equal(harness.calls.clear.length, 0);
});

test('fallo temporal de rotate antes del COMMIT no emite ni limpia cookie', async () => {
  const harness = loadHarness({
    service: { rotateSessionCredential: async () => { throw new Error('rotation rollback'); } },
  });
  const res = makeResponse();
  await harness.controller.refreshSession(
    makeRequest({ cookie: 'comuva_refresh=credential-A' }),
    res
  );
  assert.equal(res.state.status, 503);
  assert.equal(harness.calls.set.length, 0);
  assert.equal(harness.calls.clear.length, 0);
});

test('POST logout es idempotente, limpia cookie y solo presenta la sesión actual', async () => {
  const invocations = [];
  const valid = loadHarness({ service: { revokeSession: async (args) => { invocations.push(args); } } });
  const validRes = makeResponse();
  await valid.controller.logoutSession(makeRequest({ cookie: 'comuva_refresh=current' }), validRes);
  assert.equal(validRes.state.status, 204);
  assert.deepEqual(invocations, [{ credential: 'current', reason: 'user_logout' }]);
  assert.equal(valid.calls.clear.length, 1);

  const missing = loadHarness();
  const missingRes = makeResponse();
  await missing.controller.logoutSession(makeRequest(), missingRes);
  assert.equal(missingRes.state.status, 204);
  assert.equal(missing.calls.clear.length, 1);

  for (const code of ['AUTH_REFRESH_MALFORMED', 'AUTH_SESSION_NOT_FOUND', 'AUTH_SESSION_REVOKED', 'AUTH_REFRESH_INVALID']) {
    let harness;
    harness = loadHarness({ service: { revokeSession: async () => { throw new harness.AuthSessionError(code); } } });
    const res = makeResponse();
    await harness.controller.logoutSession(makeRequest({ cookie: 'comuva_refresh=bad' }), res);
    assert.equal(res.state.status, 204);
    assert.equal(harness.calls.clear.length, 1);
  }
});

test('migrate acepta JWT legacy válido o expirado reciente, crea sesión/cookie y access token', async () => {
  const original = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'migration-test-secret';
  try {
    for (const expiresIn of [60, -60]) {
      const token = jwt.sign({ id: 10 }, process.env.JWT_SECRET, { expiresIn });
      const harness = loadHarness();
      const res = makeResponse();
      await harness.controller.migrateLegacySession(makeRequest({ authorization: `Bearer ${token}` }), res);
      assert.equal(res.state.status, 200);
      assert.equal(res.state.body.access_token, 'access-token-15m');
      assert.equal(res.state.body.expires_in, 900);
      assert.deepEqual(harness.calls.set, ['created-secret']);
      assert.equal(JSON.stringify(res.state.body).includes('created-secret'), false);
    }
  } finally {
    if (original === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original;
  }
});

test('migrate rechaza >7 días, firma inválida, iat ausente y usuario inexistente', async () => {
  const original = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'migration-test-secret';
  try {
    const oldIat = Math.floor(Date.now() / 1000) - 8 * 24 * 60 * 60;
    const tooOld = jwt.sign({ id: 10, iat: oldIat }, process.env.JWT_SECRET, { expiresIn: 60 });
    const noIat = jwt.sign({ id: 10 }, process.env.JWT_SECRET, { noTimestamp: true });
    const newAccess = jwt.sign({ id: 10, token_use: 'access' }, process.env.JWT_SECRET, { expiresIn: 900 });
    for (const [token, code] of [
      [tooOld, 'AUTH_LEGACY_TOO_OLD'],
      ['invalid', 'AUTH_LEGACY_INVALID'],
      [noIat, 'AUTH_LEGACY_INVALID'],
      [newAccess, 'AUTH_LEGACY_INVALID'],
    ]) {
      const harness = loadHarness();
      const res = makeResponse();
      await harness.controller.migrateLegacySession(makeRequest({ authorization: `Bearer ${token}` }), res);
      assert.equal(res.state.status, 401);
      assert.equal(res.state.body.error.code, code);
      assert.equal(harness.calls.set.length, 0);
    }

    const noBearer = loadHarness();
    const noBearerRes = makeResponse();
    await noBearer.controller.migrateLegacySession(makeRequest(), noBearerRes);
    assert.equal(noBearerRes.state.status, 401);
    assert.equal(noBearerRes.state.body.error.code, 'AUTH_LEGACY_MISSING');
    assert.equal(noBearer.calls.set.length, 0);

    const valid = jwt.sign({ id: 999 }, process.env.JWT_SECRET, { expiresIn: 60 });
    const missingUser = loadHarness({ findByPk: async () => null });
    const res = makeResponse();
    await missingUser.controller.migrateLegacySession(makeRequest({ authorization: `Bearer ${valid}` }), res);
    assert.equal(res.state.status, 401);
    assert.equal(res.state.body.error.code, 'AUTH_LEGACY_USER_NOT_FOUND');
  } finally {
    if (original === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original;
  }
});

test('GET refresh legacy conserva Bearer, respuesta token/user y TTL solicitado de 120m', async () => {
  const original = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'migration-test-secret';
  try {
    const token = jwt.sign({ id: 10 }, process.env.JWT_SECRET, { expiresIn: -60 });
    const harness = loadHarness();
    const res = makeResponse();
    await harness.controller.refreshToken(makeRequest({ authorization: `Bearer ${token}` }), res);
    assert.equal(res.state.status, 200);
    assert.deepEqual(res.state.body, {
      token: 'legacy-token',
      user: { id: 10, authoritative: true },
    });
    assert.equal(harness.calls.set.length, 0);
    assert.equal(harness.calls.clear.length, 0);
  } finally {
    if (original === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original;
  }
});

test('migrate propaga fallo RDS como 500 y no emite cookie', async () => {
  const original = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'migration-test-secret';
  try {
    const token = jwt.sign({ id: 10 }, process.env.JWT_SECRET, { expiresIn: 60 });
    const harness = loadHarness({ findByPk: async () => { throw new Error('RDS unavailable'); } });
    const res = makeResponse();
    await harness.controller.migrateLegacySession(makeRequest({ authorization: `Bearer ${token}` }), res);
    assert.equal(res.state.status, 500);
    assert.equal(harness.calls.set.length, 0);
  } finally {
    if (original === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original;
  }
});
