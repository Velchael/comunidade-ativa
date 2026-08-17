const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { once } = require('node:events');
const {
  receiveInteractionImage,
  validateInteractionImage
} = require('../src/middleware/interactionImageUpload');
const { MAX_IMAGE_SIZE } = require('../src/utils/imageValidation');

const signatures = {
  jpeg: Buffer.from([0xff, 0xd8, 0xff, 0xdb]),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
};

const withUploadServer = async (run) => {
  const app = express();
  app.use(express.json());
  app.post('/interacciones', receiveInteractionImage, validateInteractionImage, (req, res) => {
    res.status(201).json({
      hasImage: Boolean(req.interactionImage),
      contentType: req.interactionImage?.contentType || null,
      body: req.body
    });
  });
  const server = app.listen(0);
  await once(server, 'listening');

  try {
    await run(`http://127.0.0.1:${server.address().port}/interacciones`);
  } finally {
    server.close();
    await once(server, 'close');
  }
};

test('mantém compatibilidade com JSON sem imagem', async () => {
  await withUploadServer(async (url) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tipo: 'ayuda', comunidad_id: 7 })
    });

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      hasImage: false,
      contentType: null,
      body: { tipo: 'ayuda', comunidad_id: 7 }
    });
  });
});

test('aceita multipart com uma imagem válida no campo imagen', async () => {
  await withUploadServer(async (url) => {
    const form = new FormData();
    form.append('tipo', 'ayuda');
    form.append('comunidad_id', '7');
    form.append('imagen', new Blob([signatures.jpeg], { type: 'image/jpeg' }), 'ignored.exe');
    const response = await fetch(url, { method: 'POST', body: form });

    assert.equal(response.status, 201);
    assert.equal((await response.json()).contentType, 'image/jpeg');
  });
});

test('rejeita arquivo acima de 5 MiB', async () => {
  await withUploadServer(async (url) => {
    const form = new FormData();
    form.append('tipo', 'ayuda');
    form.append('imagen', new Blob([Buffer.alloc(MAX_IMAGE_SIZE + 1)], {
      type: 'image/png'
    }), 'large.png');
    const response = await fetch(url, { method: 'POST', body: form });

    assert.equal(response.status, 413);
  });
});

test('rejeita MIME inválido', async () => {
  await withUploadServer(async (url) => {
    const form = new FormData();
    form.append('tipo', 'ayuda');
    form.append('imagen', new Blob([signatures.jpeg], { type: 'image/gif' }), 'photo.gif');
    const response = await fetch(url, { method: 'POST', body: form });

    assert.equal(response.status, 415);
  });
});

test('rejeita assinatura inválida', async () => {
  await withUploadServer(async (url) => {
    const form = new FormData();
    form.append('tipo', 'ayuda');
    form.append('imagen', new Blob([Buffer.from('not an image')], {
      type: 'image/png'
    }), 'photo.png');
    const response = await fetch(url, { method: 'POST', body: form });

    assert.equal(response.status, 415);
  });
});

test('rejeita campos multipart desconhecidos', async () => {
  await withUploadServer(async (url) => {
    const form = new FormData();
    form.append('tipo', 'ayuda');
    form.append('bucket', 'attacker-controlled');
    form.append('imagen', new Blob([signatures.png], { type: 'image/png' }), 'photo.png');
    const response = await fetch(url, { method: 'POST', body: form });

    assert.equal(response.status, 400);
  });
});
