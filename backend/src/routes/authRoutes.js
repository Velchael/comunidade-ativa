const router = require('express').Router();
const passport = require('passport');
const { googleCallback, refreshToken } = require('../controllers/authController');
const { verificarToken } = require('../middleware/authMiddleware'); // 👈 destructuring correcto

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false }),
  googleCallback
);

router.get('/refresh', verificarToken, refreshToken); // 👈 usas la función directamente

module.exports = router;

