const router = require('express').Router();
const passport = require('passport');
const { googleCallback, refreshToken } = require('../controllers/authController');
const authMiddleware  = require('../middleware/authMiddleware');

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false }),
  googleCallback
);

router.get('/refresh', authMiddleware, refreshToken);

module.exports = router;
