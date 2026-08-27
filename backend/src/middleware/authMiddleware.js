// backend/src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Middleware que exige token válido y sin expiración
const verificarToken = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (!token) {
    return res.status(401).json({
      message: 'Token não fornecido',
      error: { code: 'AUTH_ACCESS_MISSING' }
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET); // respeta expiración
    req.user = payload; // payload tendrá id, email, rol, comunidad_id, etc.
    return next();
  } catch (err) {
    console.error('verificarToken error:', err.message);
    const code = err?.name === 'TokenExpiredError'
      ? 'AUTH_ACCESS_EXPIRED'
      : 'AUTH_ACCESS_INVALID';
    return res.status(401).json({
      message: 'Token inválido ou expirado',
      error: { code }
    });
  }
};

module.exports = { verificarToken };
