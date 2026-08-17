const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildInteractionImageKey,
  createS3Service,
  isManagedInteractionImageKey,
  isManagedProfilePhotoKey,
  isManagedUserAvatarKey,
  readS3Config
} = require('../src/services/s3Service');

const INTERACTION_IMAGE_KEY =
  'production/interactions/123/11111111-2222-4333-8444-555555555555.webp';
const OTHER_INTERACTION_IMAGE_KEY =
  'production/interactions/124/11111111-2222-4333-8444-555555555555.webp';
const AVATAR_KEY =
  'production/profiles/users/42/11111111-2222-4333-8444-555555555555.jpg';

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

test('gera key válida de imagem de interação no backend', () => {
  const key = buildInteractionImageKey({
    interactionId: 123,
    extension: 'jpg',
    prefix: 'production',
    uuidFactory: () => '11111111-2222-4333-8444-555555555555'
  });

  assert.equal(
    key,
    'production/interactions/123/11111111-2222-4333-8444-555555555555.jpg'
  );
  assert.equal(isManagedInteractionImageKey({
    key,
    interactionId: 123,
    prefix: 'production'
  }), true);
});

test('upload de imagem de interação usa PutObject sem aceitar bucket ou key do chamador', async () => {
  let sentCommand;
  const body = Buffer.from([0xff, 0xd8, 0xff]);
  const service = createS3Service({
    client: {
      send: async (command) => {
        sentCommand = command;
      }
    },
    bucket: 'test-bucket',
    prefix: 'production',
    uuidFactory: () => '11111111-2222-4333-8444-555555555555'
  });

  const result = await service.uploadInteractionImage({
    interactionId: 123,
    buffer: body,
    contentType: 'image/jpeg',
    extension: 'jpg'
  });

  assert.equal(
    result.key,
    'production/interactions/123/11111111-2222-4333-8444-555555555555.jpg'
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

test('rejeita key de outra interação e key de profiles em funções de interação', async () => {
  let sends = 0;
  const service = createS3Service({
    client: { send: async () => { sends += 1; } },
    bucket: 'test-bucket',
    prefix: 'production'
  });
  const otherInteractionKey =
    'production/interactions/999/11111111-2222-4333-8444-555555555555.jpg';
  const profileKey =
    'production/profiles/users/42/11111111-2222-4333-8444-555555555555.jpg';

  assert.equal(service.isManagedInteractionImageKey({
    key: otherInteractionKey,
    interactionId: 123
  }), false);
  assert.equal(service.isManagedInteractionImageKey({
    key: profileKey,
    interactionId: 123
  }), false);
  await assert.rejects(
    service.deleteInteractionImage({ key: otherInteractionKey, interactionId: 123 }),
    { code: 'UNMANAGED_S3_KEY' }
  );
  await assert.rejects(
    service.deleteInteractionImage({ key: profileKey, interactionId: 123 }),
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

test('cache de URL assinada reutiliza a mesma URL para imagem de interação', async () => {
  const calls = [];
  const service = createS3Service({
    client: {},
    bucket: 'private-bucket',
    prefix: 'production',
    ttlSeconds: 3600,
    presign: async (...args) => {
      calls.push(args);
      return `https://signed.example/interaction-${calls.length}`;
    }
  });

  const firstUrl = await service.getSignedInteractionImageUrl({
    key: INTERACTION_IMAGE_KEY,
    interactionId: 123
  });
  const secondUrl = await service.getSignedInteractionImageUrl({
    key: INTERACTION_IMAGE_KEY,
    interactionId: 123
  });

  assert.equal(firstUrl, 'https://signed.example/interaction-1');
  assert.equal(secondUrl, firstUrl);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][1].input, {
    Bucket: 'private-bucket',
    Key: INTERACTION_IMAGE_KEY
  });
});

test('cache de URL assinada renova perto da expiração', async () => {
  let currentTime = 1_000;
  let presignCalls = 0;
  const service = createS3Service({
    client: {},
    bucket: 'private-bucket',
    prefix: 'production',
    ttlSeconds: 100,
    now: () => currentTime,
    presign: async () => {
      presignCalls += 1;
      return `https://signed.example/interaction-${presignCalls}`;
    }
  });

  const firstUrl = await service.getSignedInteractionImageUrl({
    key: INTERACTION_IMAGE_KEY,
    interactionId: 123
  });
  currentTime += 90_000;
  const secondUrl = await service.getSignedInteractionImageUrl({
    key: INTERACTION_IMAGE_KEY,
    interactionId: 123
  });

  assert.equal(firstUrl, 'https://signed.example/interaction-1');
  assert.equal(secondUrl, 'https://signed.example/interaction-2');
  assert.equal(presignCalls, 2);
});

test('cache de URL assinada mantém entradas independentes por key', async () => {
  let presignCalls = 0;
  const service = createS3Service({
    client: {},
    bucket: 'private-bucket',
    prefix: 'production',
    presign: async () => {
      presignCalls += 1;
      return `https://signed.example/media-${presignCalls}`;
    }
  });

  const firstUrl = await service.getSignedInteractionImageUrl({
    key: INTERACTION_IMAGE_KEY,
    interactionId: 123
  });
  const otherUrl = await service.getSignedInteractionImageUrl({
    key: OTHER_INTERACTION_IMAGE_KEY,
    interactionId: 124
  });
  const firstUrlAgain = await service.getSignedInteractionImageUrl({
    key: INTERACTION_IMAGE_KEY,
    interactionId: 123
  });

  assert.equal(firstUrl, 'https://signed.example/media-1');
  assert.equal(otherUrl, 'https://signed.example/media-2');
  assert.equal(firstUrlAgain, firstUrl);
  assert.equal(presignCalls, 2);
});

test('gera URL GET assinada para imagem de interação com TTL configurado', async () => {
  const calls = [];
  const client = { send: async () => {} };
  const presign = async (...args) => {
    calls.push(args);
    return 'https://signed.example/interaction';
  };
  const service = createS3Service({
    client,
    bucket: 'private-bucket',
    prefix: 'production',
    ttlSeconds: 7200,
    presign
  });
  const key = 'production/interactions/123/11111111-2222-4333-8444-555555555555.webp';

  const url = await service.getSignedInteractionImageUrl({ key, interactionId: 123 });

  assert.equal(url, 'https://signed.example/interaction');
  assert.equal(calls[0][0], client);
  assert.deepEqual(calls[0][1].input, { Bucket: 'private-bucket', Key: key });
  assert.deepEqual(calls[0][2], { expiresIn: 7200 });
});

test('deleteInteractionImage invalida cache de URL assinada da key', async () => {
  let presignCalls = 0;
  const sentCommands = [];
  const service = createS3Service({
    client: { send: async (command) => sentCommands.push(command) },
    bucket: 'private-bucket',
    prefix: 'production',
    presign: async () => {
      presignCalls += 1;
      return `https://signed.example/interaction-${presignCalls}`;
    }
  });

  const firstUrl = await service.getSignedInteractionImageUrl({
    key: INTERACTION_IMAGE_KEY,
    interactionId: 123
  });
  await service.deleteInteractionImage({
    key: INTERACTION_IMAGE_KEY,
    interactionId: 123
  });
  const secondUrl = await service.getSignedInteractionImageUrl({
    key: INTERACTION_IMAGE_KEY,
    interactionId: 123
  });

  assert.equal(firstUrl, 'https://signed.example/interaction-1');
  assert.equal(secondUrl, 'https://signed.example/interaction-2');
  assert.equal(presignCalls, 2);
  assert.deepEqual(sentCommands[0].input, {
    Bucket: 'private-bucket',
    Key: INTERACTION_IMAGE_KEY
  });
});

test('deleteUserAvatar invalida cache de URL assinada da key', async () => {
  let presignCalls = 0;
  const sentCommands = [];
  const service = createS3Service({
    client: { send: async (command) => sentCommands.push(command) },
    bucket: 'private-bucket',
    prefix: 'production',
    presign: async () => {
      presignCalls += 1;
      return `https://signed.example/avatar-${presignCalls}`;
    }
  });

  const firstUrl = await service.getSignedReadUrl(AVATAR_KEY);
  await service.deleteUserAvatar({ key: AVATAR_KEY, userId: 42 });
  const secondUrl = await service.getSignedReadUrl(AVATAR_KEY);

  assert.equal(firstUrl, 'https://signed.example/avatar-1');
  assert.equal(secondUrl, 'https://signed.example/avatar-2');
  assert.equal(presignCalls, 2);
  assert.deepEqual(sentCommands[0].input, {
    Bucket: 'private-bucket',
    Key: AVATAR_KEY
  });
});

test('cache remove entrada expirada durante limpeza', async () => {
  let currentTime = 0;
  const service = createS3Service({
    client: {},
    bucket: 'private-bucket',
    prefix: 'production',
    ttlSeconds: 1,
    now: () => currentTime,
    presign: async () => 'https://signed.example/interaction'
  });

  await service.getSignedInteractionImageUrl({
    key: INTERACTION_IMAGE_KEY,
    interactionId: 123
  });
  assert.equal(service.getSignedUrlCacheSize(), 1);

  currentTime = 1_001;
  assert.equal(service.getSignedUrlCacheSize(), 0);
});

test('cache respeita limite máximo de entradas sem crescimento infinito', async () => {
  let presignCalls = 0;
  const service = createS3Service({
    client: {},
    bucket: 'private-bucket',
    prefix: 'production',
    maxSignedUrlCacheEntries: 2,
    presign: async () => {
      presignCalls += 1;
      return `https://signed.example/media-${presignCalls}`;
    }
  });
  const firstKey = 'production/interactions/1/11111111-2222-4333-8444-555555555555.webp';
  const secondKey = 'production/interactions/2/11111111-2222-4333-8444-555555555555.webp';
  const thirdKey = 'production/interactions/3/11111111-2222-4333-8444-555555555555.webp';

  await service.getSignedInteractionImageUrl({ key: firstKey, interactionId: 1 });
  await service.getSignedInteractionImageUrl({ key: secondKey, interactionId: 2 });
  await service.getSignedInteractionImageUrl({ key: thirdKey, interactionId: 3 });

  assert.equal(service.getSignedUrlCacheSize(), 2);

  const firstUrlAgain = await service.getSignedInteractionImageUrl({
    key: firstKey,
    interactionId: 1
  });

  assert.equal(firstUrlAgain, 'https://signed.example/media-4');
  assert.equal(presignCalls, 4);
  assert.equal(service.getSignedUrlCacheSize(), 2);
});

test('TTL pequeno mantém reutilização antes da margem de segurança', async () => {
  let currentTime = 0;
  let presignCalls = 0;
  const service = createS3Service({
    client: {},
    bucket: 'private-bucket',
    prefix: 'production',
    ttlSeconds: 1,
    now: () => currentTime,
    presign: async () => {
      presignCalls += 1;
      return `https://signed.example/small-ttl-${presignCalls}`;
    }
  });

  const firstUrl = await service.getSignedInteractionImageUrl({
    key: INTERACTION_IMAGE_KEY,
    interactionId: 123
  });
  currentTime = 899;
  const secondUrl = await service.getSignedInteractionImageUrl({
    key: INTERACTION_IMAGE_KEY,
    interactionId: 123
  });
  currentTime = 900;
  const thirdUrl = await service.getSignedInteractionImageUrl({
    key: INTERACTION_IMAGE_KEY,
    interactionId: 123
  });

  assert.equal(secondUrl, firstUrl);
  assert.equal(thirdUrl, 'https://signed.example/small-ttl-2');
  assert.equal(presignCalls, 2);
});

test('getSignedReadUrl também aceita key gerenciada de interação e rejeita URL externa', async () => {
  let presignCalls = 0;
  const service = createS3Service({
    client: {},
    bucket: 'private-bucket',
    prefix: 'production',
    presign: async () => {
      presignCalls += 1;
      return 'https://signed.example/interaction';
    }
  });
  const key = 'production/interactions/123/11111111-2222-4333-8444-555555555555.png';

  assert.equal(await service.getSignedReadUrl(key), 'https://signed.example/interaction');
  await assert.rejects(
    service.getSignedReadUrl('https://example.com/interaction.png'),
    { code: 'UNMANAGED_S3_KEY' }
  );
  assert.equal(presignCalls, 1);
});

test('DeleteObject de interação só é enviado para key válida da própria interação', async () => {
  const commands = [];
  const service = createS3Service({
    client: { send: async (command) => commands.push(command) },
    bucket: 'test-bucket',
    prefix: 'production'
  });
  const key = 'production/interactions/123/11111111-2222-4333-8444-555555555555.jpg';

  await service.deleteInteractionImage({ key, interactionId: 123 });

  assert.deepEqual(commands[0].input, { Bucket: 'test-bucket', Key: key });
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
