const test = require('node:test');
const assert = require('node:assert/strict');
const { createAvatarController } = require('../src/controllers/createAvatarController');

const USER_ID = 42;
const NEW_KEY = 'production/profiles/users/42/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg';
const OLD_KEY = 'production/profiles/users/42/11111111-2222-4333-8444-555555555555.png';

const createHarness = ({
  previousPhoto = null,
  uploadError,
  rdsError,
  deleteError,
  photoAfterUpload
} = {}) => {
  const calls = [];
  const state = { foto_perfil: previousPhoto };
  const logger = { error: (...args) => calls.push(['log', ...args]) };
  const User = {
    findByPk: async (id, options = {}) => {
      calls.push(['findByPk', id, options]);
      if (options.attributes && !options.lock) {
        return { id, foto_perfil: state.foto_perfil };
      }
      if (options.lock) {
        return {
          foto_perfil: state.foto_perfil,
          update: async ({ foto_perfil }) => {
            calls.push(['update', foto_perfil]);
            if (rdsError) throw rdsError;
            state.foto_perfil = foto_perfil;
          }
        };
      }
      return { id, email: 'user@example.com', foto_perfil: state.foto_perfil };
    }
  };
  const sequelize = {
    transaction: async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } })
  };
  const s3Service = {
    uploadUserAvatar: async () => {
      calls.push(['upload']);
      if (uploadError) throw uploadError;
      if (photoAfterUpload !== undefined) state.foto_perfil = photoAfterUpload;
      return { key: NEW_KEY };
    },
    isManagedAvatar: ({ key, userId }) => (
      userId === USER_ID
      && key.startsWith(`production/profiles/users/${USER_ID}/`)
      && !key.startsWith('http')
    ),
    deleteUserAvatar: async ({ key, userId }) => {
      calls.push(['delete', key, userId]);
      if (deleteError) throw deleteError;
    }
  };
  const buildUserProfileResponse = async (user) => {
    calls.push(['buildUserProfileResponse', user]);
    return { id: user.id, foto_perfil: user.foto_perfil, officialDto: true };
  };
  const { uploadMyAvatar } = createAvatarController({
    User,
    sequelize,
    s3Service,
    buildUserProfileResponse,
    profileQuery: { include: ['profile'] },
    logger
  });
  const req = {
    user: { id: USER_ID },
    avatar: {
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
      contentType: 'image/jpeg',
      extension: 'jpg'
    }
  };
  const response = { statusCode: null, body: null };
  const res = {
    status(code) {
      response.statusCode = code;
      return this;
    },
    json(body) {
      response.body = body;
      return this;
    }
  };

  return { uploadMyAvatar, req, res, response, calls, state };
};

test('primeira foto: persiste nova key e não exclui anterior', async () => {
  const harness = createHarness();
  await harness.uploadMyAvatar(harness.req, harness.res);

  assert.equal(harness.state.foto_perfil, NEW_KEY);
  assert.equal(harness.calls.some(([name]) => name === 'delete'), false);
  assert.equal(harness.response.statusCode, 200);
});

test('foto Google anterior: persiste nova key e nunca exclui URL', async () => {
  const googlePhoto = 'https://lh3.googleusercontent.com/photo.jpg';
  const harness = createHarness({ previousPhoto: googlePhoto });
  await harness.uploadMyAvatar(harness.req, harness.res);

  assert.equal(harness.state.foto_perfil, NEW_KEY);
  assert.equal(harness.calls.some(([name]) => name === 'delete'), false);
});

test('foto COMUVA anterior: persiste nova key antes de excluir anterior', async () => {
  const harness = createHarness({ previousPhoto: OLD_KEY });
  await harness.uploadMyAvatar(harness.req, harness.res);

  const updateIndex = harness.calls.findIndex(([name]) => name === 'update');
  const deleteIndex = harness.calls.findIndex(([name]) => name === 'delete');
  assert.equal(harness.state.foto_perfil, NEW_KEY);
  assert.deepEqual(harness.calls[deleteIndex], ['delete', OLD_KEY, USER_ID]);
  assert.ok(updateIndex >= 0 && deleteIndex > updateIndex);
});

test('falha S3: não altera RDS', async () => {
  const harness = createHarness({
    previousPhoto: OLD_KEY,
    uploadError: new Error('S3 unavailable')
  });
  await harness.uploadMyAvatar(harness.req, harness.res);

  assert.equal(harness.state.foto_perfil, OLD_KEY);
  assert.equal(harness.calls.some(([name]) => name === 'update'), false);
  assert.equal(harness.response.statusCode, 502);
});

test('falha RDS após upload: tenta excluir o objeto novo', async () => {
  const harness = createHarness({
    previousPhoto: OLD_KEY,
    rdsError: new Error('RDS unavailable')
  });
  await harness.uploadMyAvatar(harness.req, harness.res);

  assert.equal(harness.state.foto_perfil, OLD_KEY);
  assert.equal(
    harness.calls.some((call) => (
      call[0] === 'delete' && call[1] === NEW_KEY && call[2] === USER_ID
    )),
    true
  );
  assert.equal(harness.response.statusCode, 500);
});

test('falha ao excluir anterior: nova referência continua oficial', async () => {
  const harness = createHarness({
    previousPhoto: OLD_KEY,
    deleteError: new Error('Delete failed')
  });
  await harness.uploadMyAvatar(harness.req, harness.res);

  assert.equal(harness.state.foto_perfil, NEW_KEY);
  assert.equal(harness.response.statusCode, 200);
  assert.equal(harness.calls.some(([name]) => name === 'log'), true);
});

test('resposta final usa buildUserProfileResponse', async () => {
  const harness = createHarness();
  await harness.uploadMyAvatar(harness.req, harness.res);

  assert.equal(
    harness.calls.some(([name]) => name === 'buildUserProfileResponse'),
    true
  );
  assert.deepEqual(harness.response.body, {
    id: USER_ID,
    foto_perfil: NEW_KEY,
    officialDto: true
  });
  assert.equal(Object.hasOwn(harness.response.body, 'etag'), false);
});

test('concorrência: cleanup usa referência vigente sob lock, não leitura inicial', async () => {
  const concurrentKey =
    'production/profiles/users/42/99999999-8888-4777-8666-555555555555.webp';
  const harness = createHarness({
    previousPhoto: OLD_KEY,
    photoAfterUpload: concurrentKey
  });
  await harness.uploadMyAvatar(harness.req, harness.res);

  const lockRead = harness.calls.find((call) => call[0] === 'findByPk' && call[2].lock);
  const deletes = harness.calls.filter(([name]) => name === 'delete');
  assert.equal(lockRead[2].lock, 'UPDATE');
  assert.deepEqual(deletes, [['delete', concurrentKey, USER_ID]]);
  assert.equal(harness.state.foto_perfil, NEW_KEY);
});
