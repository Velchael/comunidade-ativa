const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_IMAGE_SIZE,
  validateImageUpload
} = require('../src/utils/imageValidation');

const signatures = {
  jpeg: Buffer.from([0xff, 0xd8, 0xff, 0xdb]),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  webp: Buffer.from('RIFF0000WEBP', 'ascii')
};

test('valida JPEG real com MIME coerente', () => {
  assert.deepEqual(validateImageUpload({
    buffer: signatures.jpeg,
    mimetype: 'image/jpeg',
    size: signatures.jpeg.length
  }), {
    buffer: signatures.jpeg,
    size: signatures.jpeg.length,
    contentType: 'image/jpeg',
    extension: 'jpg'
  });
});

test('valida PNG real com MIME coerente', () => {
  assert.deepEqual(validateImageUpload({
    buffer: signatures.png,
    mimetype: 'image/png',
    size: signatures.png.length
  }), {
    buffer: signatures.png,
    size: signatures.png.length,
    contentType: 'image/png',
    extension: 'png'
  });
});

test('valida WebP real com MIME coerente', () => {
  assert.deepEqual(validateImageUpload({
    buffer: signatures.webp,
    mimetype: 'image/webp',
    size: signatures.webp.length
  }), {
    buffer: signatures.webp,
    size: signatures.webp.length,
    contentType: 'image/webp',
    extension: 'webp'
  });
});

test('rejeita MIME não permitido', () => {
  assert.throws(
    () => validateImageUpload({
      buffer: signatures.jpeg,
      mimetype: 'image/gif',
      size: signatures.jpeg.length
    }),
    { code: 'INVALID_IMAGE_MIME' }
  );
});

test('rejeita assinatura inválida', () => {
  assert.throws(
    () => validateImageUpload({
      buffer: Buffer.from('not an image'),
      mimetype: 'image/png',
      size: 12
    }),
    { code: 'INVALID_IMAGE_SIGNATURE' }
  );
});

test('rejeita arquivo maior que 5 MiB', () => {
  assert.throws(
    () => validateImageUpload({
      buffer: Buffer.alloc(MAX_IMAGE_SIZE + 1),
      mimetype: 'image/png',
      size: MAX_IMAGE_SIZE + 1
    }),
    { code: 'IMAGE_TOO_LARGE' }
  );
});
