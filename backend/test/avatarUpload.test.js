const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { once } = require('node:events');
const {
  MAX_AVATAR_SIZE,
  detectImageType,
  receiveAvatar,
  validateAvatar
} = require('../src/middleware/avatarUpload');

const signatures = {
  jpeg: Buffer.from([0xff, 0xd8, 0xff, 0xdb]),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  webp: Buffer.from('RIFF0000WEBP', 'ascii')
};

test('detecta apenas as assinaturas permitidas', () => {
  assert.deepEqual(detectImageType(signatures.jpeg), {
    contentType: 'image/jpeg', extension: 'jpg'
  });
  assert.deepEqual(detectImageType(signatures.png), {
    contentType: 'image/png', extension: 'png'
  });
  assert.deepEqual(detectImageType(signatures.webp), {
    contentType: 'image/webp', extension: 'webp'
  });
  assert.equal(detectImageType(Buffer.from('not an image')), null);
});

const withUploadServer = async (run) => {
  const app = express();
  app.post('/avatar', receiveAvatar, validateAvatar, (req, res) => {
    res.status(201).json({ contentType: req.avatar.contentType, size: req.avatar.size });
  });
  const server = app.listen(0);
  await once(server, 'listening');

  try {
    await run(`http://127.0.0.1:${server.address().port}/avatar`);
  } finally {
    server.close();
    await once(server, 'close');
  }
};

test('aceita um avatar cujo MIME corresponde à assinatura', async () => {
  await withUploadServer(async (url) => {
    const form = new FormData();
    form.append('avatar', new Blob([signatures.png], { type: 'image/png' }), 'ignored.exe');
    const response = await fetch(url, { method: 'POST', body: form });

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { contentType: 'image/png', size: 8 });
  });
});

test('rejeita MIME que não corresponde à assinatura real', async () => {
  await withUploadServer(async (url) => {
    const form = new FormData();
    form.append('avatar', new Blob([signatures.png], { type: 'image/jpeg' }), 'photo.jpg');
    const response = await fetch(url, { method: 'POST', body: form });

    assert.equal(response.status, 415);
  });
});

test('rejeita arquivo acima de 5 MiB', async () => {
  await withUploadServer(async (url) => {
    const form = new FormData();
    form.append(
      'avatar',
      new Blob([Buffer.alloc(MAX_AVATAR_SIZE + 1)], { type: 'image/png' }),
      'large.png'
    );
    const response = await fetch(url, { method: 'POST', body: form });

    assert.equal(response.status, 413);
  });
});

test('rejeita campo de arquivo diferente de avatar', async () => {
  await withUploadServer(async (url) => {
    const form = new FormData();
    form.append('file', new Blob([signatures.png], { type: 'image/png' }), 'photo.png');
    const response = await fetch(url, { method: 'POST', body: form });

    assert.equal(response.status, 400);
  });
});

test('rejeita mais de um arquivo avatar', async () => {
  await withUploadServer(async (url) => {
    const form = new FormData();
    form.append('avatar', new Blob([signatures.png], { type: 'image/png' }), 'one.png');
    form.append('avatar', new Blob([signatures.png], { type: 'image/png' }), 'two.png');
    const response = await fetch(url, { method: 'POST', body: form });

    assert.equal(response.status, 400);
  });
});

test('rejeita campos multipart adicionais', async () => {
  await withUploadServer(async (url) => {
    const form = new FormData();
    form.append('userId', '999');
    form.append('avatar', new Blob([signatures.png], { type: 'image/png' }), 'photo.png');
    const response = await fetch(url, { method: 'POST', body: form });

    assert.equal(response.status, 400);
  });
});
