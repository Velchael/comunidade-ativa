const multer = require('multer');
const {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE,
  detectImageType,
  validateImageUpload
} = require('../utils/imageValidation');

const MAX_AVATAR_SIZE = MAX_IMAGE_SIZE;

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AVATAR_SIZE,
    files: 1,
    fields: 0
  },
  fileFilter: (req, file, callback) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
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

  try {
    req.avatar = validateImageUpload({
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
  } catch (error) {
    if (error.code !== 'INVALID_IMAGE_SIGNATURE') return next(error);

    return res.status(415).json({
      message: 'O conteúdo do arquivo não corresponde a um JPEG, PNG ou WebP válido'
    });
  }

  return next();
};

module.exports = {
  MAX_AVATAR_SIZE,
  detectImageType,
  receiveAvatar,
  validateAvatar
};
