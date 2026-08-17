const multer = require('multer');
const {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE,
  validateImageUpload
} = require('../utils/imageValidation');

const ALLOWED_INTERACTION_FIELDS = new Set([
  'urgencia',
  'tipo',
  'descripcion',
  'categoria',
  'visibilidad',
  'comunidad_id',
  'imagen_url'
]);

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 1,
    fields: ALLOWED_INTERACTION_FIELDS.size
  },
  fileFilter: (req, file, callback) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      const error = new Error('Tipo MIME não permitido. Use JPEG, PNG ou WebP');
      error.code = 'INVALID_INTERACTION_IMAGE_MIME';
      return callback(error);
    }

    return callback(null, true);
  }
}).single('imagen');

const isMultipart = (req) => (
  typeof req.is === 'function' && req.is('multipart/form-data')
);

const receiveInteractionImage = (req, res, next) => {
  if (!isMultipart(req)) return next();

  multerUpload(req, res, (error) => {
    if (!error) {
      const unknownFields = Object.keys(req.body || {})
        .filter((field) => !ALLOWED_INTERACTION_FIELDS.has(field));

      if (unknownFields.length) {
        return res.status(400).json({
          message: 'Campos multipart não permitidos na publicação'
        });
      }

      return next();
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'A imagem deve ter no máximo 5 MiB' });
      }

      if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ message: 'Envie no máximo uma imagem no campo imagen' });
      }

      return res.status(400).json({ message: 'Multipart inválido para publicação' });
    }

    if (error.code === 'INVALID_INTERACTION_IMAGE_MIME') {
      return res.status(415).json({ message: error.message });
    }

    return next(error);
  });
};

const validateInteractionImage = (req, res, next) => {
  if (!isMultipart(req) || !req.file) return next();

  try {
    req.interactionImage = validateImageUpload({
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
  } catch (error) {
    if (error.code === 'IMAGE_TOO_LARGE') {
      return res.status(413).json({ message: 'A imagem deve ter no máximo 5 MiB' });
    }

    if (error.code === 'INVALID_IMAGE_MIME' || error.code === 'INVALID_IMAGE_SIGNATURE') {
      return res.status(415).json({
        message: 'O conteúdo do arquivo não corresponde a um JPEG, PNG ou WebP válido'
      });
    }

    return next(error);
  }

  return next();
};

module.exports = {
  receiveInteractionImage,
  validateInteractionImage
};
