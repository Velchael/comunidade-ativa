const PRODUCTION_ORIGIN = 'https://comuva.com';
const DEVELOPMENT_ORIGINS = new Set(['http://localhost:3001']);

const getAllowedOrigins = () => {
  if (process.env.NODE_ENV === 'production') return new Set([PRODUCTION_ORIGIN]);

  const origins = new Set(DEVELOPMENT_ORIGINS);
  if (process.env.FRONTEND_URL) {
    try {
      const configured = new URL(process.env.FRONTEND_URL);
      if (
        configured.protocol === 'http:' &&
        (configured.hostname === 'localhost' || configured.hostname === '127.0.0.1')
      ) {
        origins.add(configured.origin);
      }
    } catch (_) {
      // An invalid FRONTEND_URL must not broaden the allowlist.
    }
  }
  return origins;
};

const requireAuthOrigin = (req, res, next) => {
  const origin = req.get('origin');
  if (!origin || origin === 'null' || !getAllowedOrigins().has(origin)) {
    return res.status(403).json({
      message: 'Origin não permitida',
      error: { code: 'AUTH_ORIGIN_INVALID' }
    });
  }
  return next();
};

module.exports = { PRODUCTION_ORIGIN, getAllowedOrigins, requireAuthOrigin };
