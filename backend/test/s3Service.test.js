const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createS3Service,
  isManagedProfilePhotoKey,
  isManagedUserAvatarKey,
  readS3Config
} = require('../src/services/s3Service');

test('exige as três variáveis de configuração S3', () => {
  assert.throws(
    () => readS3Config({ AWS_REGION: 'us-east-1' }),
    /COMUVA_S3_BUCKET, COMUVA_S3_PREFIX/
  );
});

test('gera a key no backend e envia PutObject sem ACL', async () => {
  let sentCommand;
  const client = {
    send: async (command) => {
      sentCommand = command;
      return { ETag: '"etag-test"' };
    }
  };
  const service = createS3Service({
    client,
    bucket: 'test-bucket',
    prefix: 'production',
    uuidFactory: () => '11111111-2222-4333-8444-555555555555'
  });
  const body = Buffer.from([0xff, 0xd8, 0xff]);

  const result = await service.uploadUserAvatar({
    userId: 42,
    buffer: body,
    contentType: 'image/jpeg',
    extension: 'jpg'
  });

  assert.equal(
    result.key,
    'production/profiles/users/42/11111111-2222-4333-8444-555555555555.jpg'
  );
  assert.deepEqual(sentCommand.input, {
    Bucket: 'test-bucket',
    Key: result.key,
    Body: body,
    ContentType: 'image/jpeg'
  });
  assert.equal(Object.hasOwn(sentCommand.input, 'ACL'), false);
});

test('elimina apenas key gerenciada do mesmo usuário', async () => {
  const commands = [];
  const service = createS3Service({
    client: { send: async (command) => commands.push(command) },
    bucket: 'test-bucket',
    prefix: 'production'
  });
  const key = 'production/profiles/users/42/11111111-2222-4333-8444-555555555555.jpg';

  await service.deleteUserAvatar({ key, userId: 42 });

  assert.deepEqual(commands[0].input, { Bucket: 'test-bucket', Key: key });
});

test('rejeita exclusão de key de outro usuário e de URL', async () => {
  let sends = 0;
  const service = createS3Service({
    client: { send: async () => { sends += 1; } },
    bucket: 'test-bucket',
    prefix: 'production'
  });
  const otherUserKey =
    'production/profiles/users/99/11111111-2222-4333-8444-555555555555.jpg';

  await assert.rejects(
    service.deleteUserAvatar({ key: otherUserKey, userId: 42 }),
    { code: 'UNMANAGED_S3_KEY' }
  );
  await assert.rejects(
    service.deleteUserAvatar({ key: 'https://example.com/photo.jpg', userId: 42 }),
    { code: 'UNMANAGED_S3_KEY' }
  );
  assert.equal(sends, 0);
});

test('helper reconhece estritamente key COMUVA do próprio usuário', () => {
  const params = { userId: 42, prefix: 'production' };
  assert.equal(isManagedUserAvatarKey({
    ...params,
    key: 'production/profiles/users/42/11111111-2222-4333-8444-555555555555.webp'
  }), true);
  assert.equal(isManagedUserAvatarKey({
    ...params,
    key: 'production/profiles/users/42/not-a-uuid.webp'
  }), false);
  assert.equal(isManagedUserAvatarKey({
    ...params,
    key: 'production/profiles/users/99/11111111-2222-4333-8444-555555555555.webp'
  }), false);
});

test('gera URL GET assinada com TTL configurado sem expor bucket ao chamador', async () => {
  const calls = [];
  const client = { send: async () => {} };
  const presign = async (...args) => {
    calls.push(args);
    return 'https://signed.example/avatar';
  };
  const service = createS3Service({
    client,
    bucket: 'private-bucket',
    prefix: 'production',
    ttlSeconds: 3600,
    presign
  });
  const key = 'production/profiles/users/42/11111111-2222-4333-8444-555555555555.jpg';

  const url = await service.getSignedReadUrl(key);

  assert.equal(url, 'https://signed.example/avatar');
  assert.equal(calls[0][0], client);
  assert.deepEqual(calls[0][1].input, { Bucket: 'private-bucket', Key: key });
  assert.deepEqual(calls[0][2], { expiresIn: 3600 });
});

test('não assina key fora do prefixo de fotos gerenciadas', async () => {
  let presignCalls = 0;
  const service = createS3Service({
    client: {},
    bucket: 'private-bucket',
    prefix: 'production',
    presign: async () => { presignCalls += 1; }
  });

  await assert.rejects(
    service.getSignedReadUrl(
      'staging/profiles/users/42/11111111-2222-4333-8444-555555555555.jpg'
    ),
    { code: 'UNMANAGED_S3_KEY' }
  );
  assert.equal(presignCalls, 0);
  assert.equal(isManagedProfilePhotoKey({
    prefix: 'production',
    key: 'production/other/11111111-2222-4333-8444-555555555555.jpg'
  }), false);
});

test('configuração usa TTL padrão de 3600 segundos', () => {
  const config = readS3Config({
    AWS_REGION: 'us-east-1',
    COMUVA_S3_BUCKET: 'private-bucket',
    COMUVA_S3_PREFIX: 'production'
  });

  assert.equal(config.ttlSeconds, 3600);
});
