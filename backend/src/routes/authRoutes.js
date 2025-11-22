
// backend/routes/authRoutes.js
const router = require('express').Router();
const passport = require('passport');
const authController = require('../controllers/authController');
const { verificarToken } = require('../middleware/authMiddleware');

// Login normal
router.post('/login', authController.login);

// Google oauth start
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google callback
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false }),
  authController.googleCallback
);

// Me (protege con verificarToken estándar)
router.get('/me', verificarToken, authController.getMe);

// Refresh token (NO usar verificarToken aquí: aceptamos token expirado pero con firma valida)
// Se usa GET para facilitar pruebas; si prefieres POST, cámbialo.
router.get('/refresh', authController.refreshToken);

module.exports = router;
