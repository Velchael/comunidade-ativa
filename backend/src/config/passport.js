const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { Usuario: User } = require('../models');

// Validar variables de entorno críticas
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error('❌ GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET son requeridos');
}

passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.NODE_ENV === 'production'
      ? "https://comuva.com/api/auth/google/callback"
      : "http://localhost:3000/api/auth/google/callback",
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
      const googleId = profile.id;
      const avatar = profile.photos[0]?.value;

      // ✅ Esta línea extrae el primer nombre de forma segura y clara
      const username = profile.name?.givenName || profile.displayName?.split(' ')[0] || email.split('@')[0];

      let user = await User.findOne({ where: { email } });

      if (user) {
        if (!user.googleId) {
          user.googleId = googleId;
          await user.save();
        }
        return done(null, user);
      }

      // 🚀 Crear nuevo usuario con solo su primer nombre
      user = await User.create({
        email,
        username, // ← aquí lo usás
        googleId,
        foto_perfil: avatar,
        password: 'oauth-google',
      });

      return done(null, user);
    } catch (err) {
      console.error('❌ Error en GoogleStrategy:', err.message);
      return done(err);
    }
  }
));

module.exports = passport;


