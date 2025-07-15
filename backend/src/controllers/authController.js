const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();

const googleCallback = async (req, res) => {
  try {
    const user = req.user;

    if (!user || !user.id) {
      return res.status(401).json({ message: 'Error en autenticación Google (usuario inválido)' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        rol: user.rol,
        username: user.username,
        googleId: user.googleId
      },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }
    );

    const redirectURL = `${process.env.FRONTEND_URL}/seinscrever?token=${token}`;
    return res.redirect(redirectURL);
  } catch (err) {
    console.error('❌ Error en callback Google:', err.message);
    return res.status(500).json({ message: 'Error interno en autenticación con Google' });
  }
};

module.exports = {
  googleCallback,
};

