const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { User } = require('../models');

const getValidGooglePhotoUrl = (profile) => {
  const googlePhotoUrl =
    typeof profile.photos?.[0]?.value === 'string'
      ? profile.photos[0].value.trim()
      : null;

  if (!googlePhotoUrl || googlePhotoUrl.length > 255) {
    return null;
  }

  try {
    const parsedUrl = new URL(googlePhotoUrl);
    return parsedUrl.protocol === 'https:' ? googlePhotoUrl : null;
  } catch (err) {
    return null;
  }
};

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
      const googlePhotoUrl = getValidGooglePhotoUrl(profile);

      // ✅ Esta línea extrae el primer nombre de forma segura y clara
      const username = profile.name?.givenName || profile.displayName?.split(' ')[0] || email.split('@')[0];

      let user = await User.findOne({ where: { email } });

      if (user) {
        const hasStoredPhoto =
          typeof user.foto_perfil === 'string' && user.foto_perfil.trim() !== '';
        const updates = {};

        if (!user.googleId && googleId) {
          updates.googleId = googleId;
        }

        if (!hasStoredPhoto && googlePhotoUrl) {
          updates.foto_perfil = googlePhotoUrl;
        }

        if (Object.keys(updates).length > 0) {
          await user.update(updates, {
            fields: Object.keys(updates)
          });
        }
        return done(null, user);
      }

      // 🚀 Crear nuevo usuario con solo su primer nombre
      user = await User.create({
        email,
        username, // ← aquí lo usás
        googleId,
        foto_perfil: googlePhotoUrl,
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

