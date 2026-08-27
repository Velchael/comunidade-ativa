const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AUTH_SESSION_IDLE_DAYS,
  AUTH_SESSION_ABSOLUTE_DAYS,
  AuthSessionError,
  createAuthSessionService,
} = require('../src/services/authSessionService');
const {
  buildRefreshCredential,
  hashRefreshSecret,
  parseRefreshCredential,
} = require('../src/utils/refreshCredentials');

const DAY_MS = 86_400_000;
const SESSION_ID = 'a6893c27-ea0c-4663-8ea1-80d0d9a38e18';
const NOW = new Date('2026-08-26T12:00:00.000Z');

const makeSession = (overrides = {}, { updateError = null } = {}) => {
  const updates = [];
  const session = {
    id: SESSION_ID,
    user_id: 10,
    family_id: 'bd7f2f52-f3de-4444-aa3c-56376ac61722',
    refresh_token_hash: hashRefreshSecret(Buffer.alloc(32, 1)),
    previous_refresh_token_hash: null,
    rotation_counter: '7',
    rotated_at: null,
    previous_valid_until: null,
    last_used_at: new Date(NOW.getTime() - 1000),
    expires_at: new Date(NOW.getTime() + DAY_MS),
    absolute_expires_at: new Date(NOW.getTime() + 2 * DAY_MS),
    revoked_at: null,
    revoked_reason: null,
    ...overrides,
  };
  session.update = async (values, options) => {
    updates.push({ values, options });
    if (updateError) throw updateError;
    for (const [key, value] of Object.entries(values)) {
      session[key] = key === 'rotation_counter' ? String(BigInt(session[key]) + 1n) : value;
    }
    return session;
  };
  session.reload = async () => {
    throw new Error('rotation must not issue reload');
  };
  session.updates = updates;
  return session;
};

const makeHarness = ({ session = null, createError = null } = {}) => {
  const calls = { creates: [], finds: [], transactions: 0, transactionEvents: [] };
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const AuthSession = {
    async create(values, options) {
      calls.creates.push({ values, options });
      if (createError) throw createError;
      return makeSession(values);
    },
    async findByPk(id, options) {
      calls.finds.push({ id, options });
      return session;
    },
  };
  const sequelize = {
    async transaction(callback) {
      calls.transactions += 1;
      calls.transactionEvents.push('BEGIN');
      try {
        const result = await callback(transaction);
        calls.transactionEvents.push('COMMIT');
        return result;
      } catch (error) {
        calls.transactionEvents.push('ROLLBACK');
        throw error;
      }
    },
    literal(sql) { return { literal: sql }; },
  };
  return {
    calls,
    transaction,
    service: createAuthSessionService({ AuthSession, sequelize, now: () => new Date(NOW) }),
  };
};

const expectCode = async (promise, code) => {
  await assert.rejects(promise, (error) => {
    assert.equal(error instanceof AuthSessionError, true);
    assert.equal(error.code, code);
    return true;
  });
};

test('createSession persiste solo hash y fechas coherentes, y devuelve credential', async () => {
  const harness = makeHarness();
  const result = await harness.service.createSession({ userId: 10 });
  const values = harness.calls.creates[0].values;
  assert.match(values.id, /^[0-9a-f-]{36}$/);
  assert.match(values.family_id, /^[0-9a-f-]{36}$/);
  assert.equal(values.refresh_token_hash.length, 32);
  assert.equal(values.rotation_counter, 0);
  assert.equal(values.previous_refresh_token_hash, null);
  assert.equal(values.rotated_at, null);
  assert.equal(values.previous_valid_until, null);
  assert.equal(values.created_at.getTime(), NOW.getTime());
  assert.equal(values.updated_at.getTime(), NOW.getTime());
  assert.equal(values.last_used_at.getTime(), NOW.getTime());
  assert.equal(values.expires_at.getTime() - NOW.getTime(), AUTH_SESSION_IDLE_DAYS * DAY_MS);
  assert.equal(values.absolute_expires_at.getTime() - NOW.getTime(), AUTH_SESSION_ABSOLUTE_DAYS * DAY_MS);
  assert.equal('secret' in values, false);
  assert.equal('credential' in values, false);
  const parsed = parseRefreshCredential(result.credential);
  assert.equal(parsed.sessionId, values.id);
  assert.deepEqual(hashRefreshSecret(parsed.secret), values.refresh_token_hash);
});

test('createSession propaga fallo de create y no devuelve credential', async () => {
  const failure = new Error('create failed');
  const harness = makeHarness({ createError: failure });
  let result;
  await assert.rejects(
    harness.service.createSession({ userId: 10 }).then((value) => { result = value; }),
    failure
  );
  assert.equal(result, undefined);
});

test('createSession pasa transaction externa y su credential es provisional hasta commit', async () => {
  const harness = makeHarness();
  const externalTransaction = { id: 'external' };
  const provisional = await harness.service.createSession({ userId: 10, transaction: externalTransaction });
  assert.equal(harness.calls.creates[0].options.transaction, externalTransaction);
  assert.equal(parseRefreshCredential(provisional.credential).sessionId, provisional.session.id);

  let browserCredential;
  await assert.rejects((async () => {
    const created = await harness.service.createSession({ userId: 10, transaction: externalTransaction });
    throw new Error(`external rollback discards ${created.result}`);
  })(), /external rollback/);
  assert.equal(browserCredential, undefined);
});

test('credential malformed no consulta DB', async () => {
  const harness = makeHarness();
  await expectCode(harness.service.rotateSessionCredential({ credential: 'bad' }), 'AUTH_REFRESH_MALFORMED');
  assert.equal(harness.calls.finds.length, 0);
  assert.equal(harness.calls.transactions, 0);
});

test('credential missing, sesión inexistente y revocada tienen códigos distintos', async () => {
  const missingHarness = makeHarness();
  await expectCode(missingHarness.service.rotateSessionCredential(), 'AUTH_REFRESH_MISSING');
  assert.equal(missingHarness.calls.finds.length, 0);

  const credential = buildRefreshCredential(SESSION_ID, Buffer.alloc(32, 1));
  const notFoundHarness = makeHarness();
  await expectCode(
    notFoundHarness.service.rotateSessionCredential({ credential }),
    'AUTH_SESSION_NOT_FOUND'
  );

  const revokedHarness = makeHarness({ session: makeSession({ revoked_at: new Date(NOW) }) });
  await expectCode(
    revokedHarness.service.rotateSessionCredential({ credential }),
    'AUTH_SESSION_REVOKED'
  );
});

test('current válido rota atómicamente bajo lock y mantiene absolute', async () => {
  const currentSecret = Buffer.alloc(32, 1);
  const oldHash = hashRefreshSecret(currentSecret);
  const absolute = new Date(NOW.getTime() + 2 * DAY_MS);
  const session = makeSession({ refresh_token_hash: oldHash, absolute_expires_at: absolute });
  const harness = makeHarness({ session });
  const result = await harness.service.rotateSessionCredential({
    credential: buildRefreshCredential(SESSION_ID, currentSecret),
  });
  assert.equal(harness.calls.finds[0].options.lock, 'UPDATE');
  assert.equal(result.result, 'ROTATED');
  assert.notDeepEqual(session.refresh_token_hash, oldHash);
  assert.deepEqual(session.previous_refresh_token_hash, oldHash);
  assert.equal(session.rotation_counter, '8');
  assert.equal(session.rotated_at.getTime(), NOW.getTime());
  assert.equal(session.last_used_at.getTime(), NOW.getTime());
  assert.equal(session.expires_at.getTime(), absolute.getTime());
  assert.equal(session.absolute_expires_at, absolute);
  assert.equal(session.updates[0].values.rotation_counter.literal, 'rotation_counter + 1');
  assert.equal(session.updates[0].options.returning, true);
  assert.equal(session.updates.length, 1);
  assert.deepEqual(hashRefreshSecret(parseRefreshCredential(result.credential).secret), session.refresh_token_hash);
});

test('previous dentro de grace produce race recuperable sin escritura', async () => {
  const previousSecret = Buffer.alloc(32, 2);
  const session = makeSession({
    previous_refresh_token_hash: hashRefreshSecret(previousSecret),
    previous_valid_until: new Date(NOW.getTime() + 10_000),
  });
  const harness = makeHarness({ session });
  await assert.rejects(
    harness.service.rotateSessionCredential({ credential: buildRefreshCredential(SESSION_ID, previousSecret) }),
    (error) => error.code === 'AUTH_REFRESH_RACE' && error.recoverable === true
  );
  assert.equal(session.updates.length, 0);
});

test('previous fuera de grace revoca solo la sesión por reuse', async () => {
  const previousSecret = Buffer.alloc(32, 2);
  const session = makeSession({
    previous_refresh_token_hash: hashRefreshSecret(previousSecret),
    previous_valid_until: new Date(NOW.getTime() - 1),
  });
  const harness = makeHarness({ session });
  await expectCode(
    harness.service.rotateSessionCredential({ credential: buildRefreshCredential(SESSION_ID, previousSecret) }),
    'AUTH_REFRESH_REUSE'
  );
  assert.equal(session.revoked_reason, 'refresh_token_reuse');
  assert.equal(session.updates.length, 1);
  assert.deepEqual(harness.calls.transactionEvents, ['BEGIN', 'COMMIT']);
});

test('secret desconocido no revoca ni escribe', async () => {
  const session = makeSession();
  const harness = makeHarness({ session });
  await expectCode(
    harness.service.rotateSessionCredential({ credential: buildRefreshCredential(SESSION_ID, Buffer.alloc(32, 9)) }),
    'AUTH_REFRESH_INVALID'
  );
  assert.equal(session.revoked_at, null);
  assert.equal(session.updates.length, 0);
});

test('expiración absolute tiene precedencia, idle se clasifica aparte y no rota', async () => {
  const secret = Buffer.alloc(32, 1);
  const absolute = makeSession({
    expires_at: new Date(NOW.getTime() - 1),
    absolute_expires_at: new Date(NOW.getTime() - 1),
  });
  const absoluteHarness = makeHarness({ session: absolute });
  await expectCode(
    absoluteHarness.service.rotateSessionCredential({ credential: buildRefreshCredential(SESSION_ID, secret) }),
    'AUTH_SESSION_ABSOLUTE_EXPIRED'
  );
  assert.equal(absolute.revoked_reason, 'absolute_expired');
  assert.equal(absolute.updates.length, 1);
  assert.deepEqual(absoluteHarness.calls.transactionEvents, ['BEGIN', 'COMMIT']);

  const idle = makeSession({ expires_at: new Date(NOW.getTime() - 1) });
  const idleHarness = makeHarness({ session: idle });
  await expectCode(
    idleHarness.service.rotateSessionCredential({ credential: buildRefreshCredential(SESSION_ID, secret) }),
    'AUTH_SESSION_IDLE_EXPIRED'
  );
  assert.equal(idle.revoked_reason, 'idle_expired');
  assert.equal(idle.updates.length, 1);
  assert.deepEqual(idleHarness.calls.transactionEvents, ['BEGIN', 'COMMIT']);
});

test('rotate y revoke siempre administran transacción propia e ignoran transaction del caller', async () => {
  const suppliedTransaction = { LOCK: { UPDATE: 'EXTERNAL' } };
  const rotateHarness = makeHarness({ session: makeSession() });
  await rotateHarness.service.rotateSessionCredential({
    credential: buildRefreshCredential(SESSION_ID, Buffer.alloc(32, 1)),
    transaction: suppliedTransaction,
  });
  assert.equal(rotateHarness.calls.finds[0].options.transaction, rotateHarness.transaction);

  const revokeHarness = makeHarness({ session: makeSession() });
  await revokeHarness.service.revokeSession({
    credential: buildRefreshCredential(SESSION_ID, Buffer.alloc(32, 1)),
    transaction: suppliedTransaction,
  });
  assert.equal(revokeHarness.calls.finds[0].options.transaction, revokeHarness.transaction);
});

test('fallo no tipado de update revierte transacción y no devuelve credential ni simula commit', async () => {
  const failure = new Error('SQL update failed');
  const session = makeSession({}, { updateError: failure });
  const harness = makeHarness({ session });
  let result;
  await assert.rejects(
    harness.service.rotateSessionCredential({
      credential: buildRefreshCredential(SESSION_ID, Buffer.alloc(32, 1)),
    }).then((value) => { result = value; }),
    failure
  );
  assert.equal(result, undefined);
  assert.deepEqual(harness.calls.transactionEvents, ['BEGIN', 'ROLLBACK']);
});

test('revokeSession exige current válido y revoca únicamente por user_logout', async () => {
  const secret = Buffer.alloc(32, 1);
  const session = makeSession();
  const harness = makeHarness({ session });
  const result = await harness.service.revokeSession({
    credential: buildRefreshCredential(SESSION_ID, secret),
  });
  assert.equal(result.result, 'REVOKED');
  assert.equal(session.revoked_reason, 'user_logout');
  assert.equal(session.updates.length, 1);
});

test('test unitario simula transacción y FOR UPDATE sin afirmar integración PostgreSQL', async () => {
  const session = makeSession();
  const harness = makeHarness({ session });
  await harness.service.rotateSessionCredential({
    credential: buildRefreshCredential(SESSION_ID, Buffer.alloc(32, 1)),
  });
  assert.equal(harness.calls.transactions, 1);
  assert.equal(harness.calls.finds[0].options.transaction, harness.transaction);
  assert.equal(harness.calls.finds[0].options.lock, harness.transaction.LOCK.UPDATE);
});

test.todo('PostgreSQL real: SELECT FOR UPDATE y bloqueo de fila con dos conexiones concurrentes');
test.todo('PostgreSQL real: commit/rollback y aislamiento transaccional');
test.todo('PostgreSQL real: RETURNING conserva BIGINT sin pérdida de precisión');
test.todo('PostgreSQL real: constraints BYTEA');
test.todo('PostgreSQL real: ejecución controlada de migration');
