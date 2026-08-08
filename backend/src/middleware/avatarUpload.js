const multer = require('multer');

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

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

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AVATAR_SIZE,
    files: 1,
    fields: 0
  },
  fileFilter: (req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      const error = new Error('Tipo MIME não permitido. Use JPEG, PNG ou WebP');
      error.code = 'INVALID_AVATAR_MIME';
      return callback(error);
    }

    return callback(null, true);
  }
}).single('avatar');

const receiveAvatar = (req, res, next) => {
  multerUpload(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'O avatar deve ter no máximo 5 MiB' });
      }

      return res.status(400).json({ message: 'Envie exatamente um arquivo no campo avatar' });
    }

    if (error.code === 'INVALID_AVATAR_MIME') {
      return res.status(415).json({ message: error.message });
    }

    return next(error);
  });
};

const validateAvatar = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Envie exatamente um arquivo no campo avatar' });
  }

  const detectedType = detectImageType(req.file.buffer);
  if (!detectedType || detectedType.contentType !== req.file.mimetype) {
    return res.status(415).json({
      message: 'O conteúdo do arquivo não corresponde a um JPEG, PNG ou WebP válido'
    });
  }

  req.avatar = {
    buffer: req.file.buffer,
    size: req.file.size,
    contentType: detectedType.contentType,
    extension: detectedType.extension
  };
  return next();
};

module.exports = {
  MAX_AVATAR_SIZE,
  detectImageType,
  receiveAvatar,
  validateAvatar
};
