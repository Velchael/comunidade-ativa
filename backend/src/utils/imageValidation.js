const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const detectImageType = (buffer) => {
  if (!Buffer.isBuffer(buffer)) return null;

  if (
    buffer.length >= 3
    && buffer[0] === 0xff
    && buffer[1] === 0xd8
    && buffer[2] === 0xff
  ) {
    return { contentType: 'image/jpeg', extension: 'jpg' };
  }

  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(pngSignature)) {
    return { contentType: 'image/png', extension: 'png' };
  }

  if (
    buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { contentType: 'image/webp', extension: 'webp' };
  }

  return null;
};

const createImageValidationError = (message, code) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const validateImageUpload = ({ buffer, mimetype, size = buffer?.length } = {}) => {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimetype)) {
    throw createImageValidationError(
      'Tipo MIME não permitido. Use JPEG, PNG ou WebP',
      'INVALID_IMAGE_MIME'
    );
  }

  if (!Number.isInteger(size) || size > MAX_IMAGE_SIZE) {
    throw createImageValidationError('A imagem deve ter no máximo 5 MiB', 'IMAGE_TOO_LARGE');
  }

  const detectedType = detectImageType(buffer);
  if (!detectedType || detectedType.contentType !== mimetype) {
    throw createImageValidationError(
      'O conteúdo do arquivo não corresponde a um JPEG, PNG ou WebP válido',
      'INVALID_IMAGE_SIGNATURE'
    );
  }

  return {
    buffer,
    size,
    contentType: detectedType.contentType,
    extension: detectedType.extension
  };
};

module.exports = {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE,
  detectImageType,
  validateImageUpload
};
