process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize, DataTypes } = require('sequelize');

const defineAuthSession = require('../src/models/AuthSession');
const defineUser = require('../src/models/User');
const migration = require('../migrations/20260826000001-create-auth-sessions');

const createSequelize = () => new Sequelize(
  'postgresql://test:test@127.0.0.1:5432/test',
  { logging: false }
);

const createMigrationHarness = () => {
  const calls = [];
  const transaction = { id: 'test-transaction' };
  const queryInterface = {
    sequelize: {
      async transaction(callback) {
        calls.push(['transaction']);
        return callback(transaction);
      },
      async query(sql, options) {
        calls.push(['query', sql, options]);
      },
    },
    async createTable(...args) {
      calls.push(['createTable', ...args]);
    },
    async addConstraint(...args) {
      calls.push(['addConstraint', ...args]);
    },
    async addIndex(...args) {
      calls.push(['addIndex', ...args]);
    },
    async dropTable(...args) {
      calls.push(['dropTable', ...args]);
    },
  };

  return { calls, queryInterface, transaction };
};

test('migration define el schema PostgreSQL contractual de auth_sessions', async () => {
  const harness = createMigrationHarness();
  await migration.up(harness.queryInterface, Sequelize);

  const createTableCall = harness.calls.find(([name]) => name === 'createTable');
  assert.ok(createTableCall);
  assert.equal(createTableCall[1], 'auth_sessions');

  const columns = createTableCall[2];
  assert.deepEqual(Object.keys(columns), [
    'id',
    'user_id',
    'family_id',
    'refresh_token_hash',
    'previous_refresh_token_hash',
    'rotation_counter',
    'rotated_at',
    'previous_valid_until',
    'created_at',
    'updated_at',
    'last_used_at',
    'expires_at',
    'absolute_expires_at',
    'revoked_at',
    'revoked_reason',
  ]);

  assert.equal(columns.id.type.key, 'UUID');
  assert.equal(columns.id.primaryKey, true);
  assert.equal(columns.id.autoIncrement, undefined);
  assert.equal(columns.user_id.type.key, 'INTEGER');
  assert.deepEqual(columns.user_id.references, { model: 'users', key: 'id' });
  assert.equal(columns.user_id.onDelete, 'CASCADE');
  assert.equal(columns.family_id.type.key, 'UUID');
  assert.equal(columns.refresh_token_hash.type.key, 'BLOB');
  assert.equal(columns.previous_refresh_token_hash.type.key, 'BLOB');
  assert.equal(columns.previous_refresh_token_hash.allowNull, true);
  assert.equal(columns.rotation_counter.type.key, 'BIGINT');
  assert.equal(columns.rotation_counter.defaultValue, 0);
  assert.equal(columns.revoked_reason.type.options.length, 32);

  for (const field of ['created_at', 'updated_at', 'last_used_at', 'expires_at', 'absolute_expires_at']) {
    assert.equal(columns[field].allowNull, false, `${field} debe ser NOT NULL`);
    assert.equal(columns[field].type.key, 'DATE');
  }

  for (const field of ['rotated_at', 'previous_valid_until', 'revoked_at', 'revoked_reason']) {
    assert.equal(columns[field].allowNull, true, `${field} debe aceptar NULL`);
  }
});

test('migration crea UNIQUE sin duplicar sus índices y añade solo los dos índices aprobados', async () => {
  const harness = createMigrationHarness();
  await migration.up(harness.queryInterface, Sequelize);

  const constraints = harness.calls
    .filter(([name]) => name === 'addConstraint')
    .map(([, table, options]) => ({ table, ...options }));

  assert.deepEqual(constraints.map(({ name, fields, type }) => ({ name, fields, type })), [
    {
      name: 'auth_sessions_family_id_key',
      fields: ['family_id'],
      type: 'unique',
    },
    {
      name: 'auth_sessions_refresh_token_hash_key',
      fields: ['refresh_token_hash'],
      type: 'unique',
    },
  ]);

  const indexes = harness.calls.filter(([name]) => name === 'addIndex');
  assert.equal(indexes.length, 2);
  assert.equal(indexes[0][1], 'auth_sessions');
  assert.deepEqual(indexes[0][2], ['user_id']);
  assert.equal(indexes[0][3].name, 'auth_sessions_user_id_idx');
  assert.equal(indexes[1][1], 'auth_sessions');
  assert.deepEqual(indexes[1][2], ['expires_at', 'id']);
  assert.equal(indexes[1][3].name, 'auth_sessions_expires_at_id_idx');
});

test('migration exige hashes, contador, expiraciones y revocación consistentes', async () => {
  const harness = createMigrationHarness();
  await migration.up(harness.queryInterface, Sequelize);

  const sql = harness.calls
    .filter(([name]) => name === 'query')
    .map(([, statement]) => statement.replace(/\s+/g, ' ').trim())
    .join(' ');

  assert.match(sql, /octet_length\(refresh_token_hash\) = 32/);
  assert.match(sql, /octet_length\(previous_refresh_token_hash\) = 32/);
  assert.match(sql, /rotation_counter >= 0/);
  assert.match(sql, /expires_at <= absolute_expires_at/);
  assert.match(sql, /expires_at > created_at/);
  assert.match(sql, /absolute_expires_at > created_at/);
  assert.match(sql, /revoked_at IS NULL AND revoked_reason IS NULL/);
  assert.match(sql, /revoked_at IS NOT NULL AND revoked_reason IS NOT NULL/);
});

test('down elimina únicamente auth_sessions', async () => {
  const harness = createMigrationHarness();
  await migration.down(harness.queryInterface);
  assert.deepEqual(harness.calls, [['dropTable', 'auth_sessions']]);
});

test('modelo AuthSession refleja BYTEA, timestamps, nulabilidad y unicidad', () => {
  const sequelize = createSequelize();
  const AuthSession = defineAuthSession(sequelize, DataTypes);
  const attributes = AuthSession.rawAttributes;

  assert.equal(AuthSession.tableName, 'auth_sessions');
  assert.equal(AuthSession._timestampAttributes.createdAt, 'created_at');
  assert.equal(AuthSession._timestampAttributes.updatedAt, 'updated_at');
  assert.equal(attributes.id.primaryKey, true);
  assert.equal(attributes.id.type.key, 'UUID');
  assert.equal(attributes.id.defaultValue.key, 'UUIDV4');
  assert.notEqual(attributes.id.autoIncrement, true);
  assert.equal(attributes.user_id.type.key, 'INTEGER');
  assert.equal(attributes.refresh_token_hash.type.key, 'BLOB');
  assert.equal(attributes.previous_refresh_token_hash.type.key, 'BLOB');
  assert.equal(attributes.refresh_token_hash.type.toSql(), 'BYTEA');
  assert.equal(attributes.previous_refresh_token_hash.type.toSql(), 'BYTEA');
  assert.equal(attributes.refresh_token_hash.unique, 'auth_sessions_refresh_token_hash_key');
  assert.equal(attributes.family_id.unique, 'auth_sessions_family_id_key');
  assert.equal(attributes.rotation_counter.type.key, 'BIGINT');
  assert.equal(attributes.rotation_counter.defaultValue, 0);
  assert.equal(attributes.revoked_reason.type.options.length, 32);
  assert.equal(attributes.user_id.unique, undefined);

  assert.deepEqual(
    AuthSession.options.indexes.map(({ name, fields }) => ({ name, fields })),
    [
      { name: 'auth_sessions_user_id_idx', fields: ['user_id'] },
      { name: 'auth_sessions_expires_at_id_idx', fields: ['expires_at', 'id'] },
    ]
  );
});

test('modelo valida hashes de exactamente 32 bytes y rotation_counter no negativo', async () => {
  const sequelize = createSequelize();
  const AuthSession = defineAuthSession(sequelize, DataTypes);
  const base = {
    user_id: 1,
    family_id: 'a6893c27-ea0c-4663-8ea1-80d0d9a38e18',
    refresh_token_hash: Buffer.alloc(32),
    expires_at: new Date('2027-02-22T00:00:00.000Z'),
    absolute_expires_at: new Date('2027-08-26T00:00:00.000Z'),
  };

  await assert.doesNotReject(() => AuthSession.build(base).validate());
  await assert.rejects(
    () => AuthSession.build({ ...base, refresh_token_hash: Buffer.alloc(31) }).validate(),
    /32-byte Buffer/
  );
  await assert.rejects(
    () => AuthSession.build({ ...base, previous_refresh_token_hash: Buffer.alloc(33) }).validate(),
    /32-byte Buffer/
  );
  await assert.rejects(
    () => AuthSession.build({ ...base, rotation_counter: -1 }).validate(),
    /Validation/
  );
});

test('modelo valida que la expiración inactiva no exceda la absoluta', async () => {
  const sequelize = createSequelize();
  const AuthSession = defineAuthSession(sequelize, DataTypes);
  const invalid = AuthSession.build({
    user_id: 1,
    family_id: 'bd7f2f52-f3de-4444-aa3c-56376ac61722',
    refresh_token_hash: Buffer.alloc(32),
    expires_at: new Date('2027-08-27T00:00:00.000Z'),
    absolute_expires_at: new Date('2027-08-26T00:00:00.000Z'),
  });

  await assert.rejects(() => invalid.validate(), /expires_at must not exceed/);
});

test('asociación User/AuthSession permite varias sesiones por usuario', () => {
  const sequelize = createSequelize();
  const User = defineUser(sequelize, DataTypes);
  const AuthSession = defineAuthSession(sequelize, DataTypes);

  User.associate({
    Comunidad: sequelize.define('Comunidad', {}),
    ComunidadMiembro: sequelize.define('ComunidadMiembro', {}),
    ComunidadInvitacion: sequelize.define('ComunidadInvitacion', {}),
    AuthSession,
  });
  AuthSession.associate({ User });

  assert.equal(User.associations.authSessions.associationType, 'HasMany');
  assert.equal(User.associations.authSessions.foreignKey, 'user_id');
  assert.equal(AuthSession.associations.user.associationType, 'BelongsTo');
  assert.equal(AuthSession.associations.user.foreignKey, 'user_id');
});

test('contrato UNIQUE impide duplicar family_id y refresh_token_hash', () => {
  const sequelize = createSequelize();
  const AuthSession = defineAuthSession(sequelize, DataTypes);

  assert.equal(AuthSession.rawAttributes.family_id.unique, 'auth_sessions_family_id_key');
  assert.equal(
    AuthSession.rawAttributes.refresh_token_hash.unique,
    'auth_sessions_refresh_token_hash_key'
  );
  assert.equal(AuthSession.rawAttributes.user_id.unique, undefined);
});
