const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();

/**
 * Callback de Google OAuth
 */
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

/**
 * Endpoint opcional: refrescar token
 */
//const refreshToken = (req, res) => {
  //try {
   // const user = req.user;
   // const newToken = jwt.sign({
    //  id: user.id,
    //  email: user.email,
    //  rol: user.rol,
    //  username: user.username,
     // googleId: user.googleId
    //}, process.env.JWT_SECRET, { expiresIn: '30m' });

   // res.json({ token: newToken });
  //} catch (err) {
   // //console.error('❌ Error al refrescar token:', err.message);
    //res.status(500).json({ message: 'Error al refrescar token' });
 // }
//};

const refreshToken = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const newToken = jwt.sign({
      id: user.id,
      email: user.email,
      rol: user.rol,
      username: user.username,
      googleId: user.googleId
    }, process.env.JWT_SECRET, { expiresIn: '30m' });

    res.json({ token: newToken });
    console.log('🔁 Refresh nuevo token enviado:', newToken);

  } catch (err) {
    res.status(500).json({ message: 'Error al generar nuevo token' });
  }
};


module.exports = {
  googleCallback,
  refreshToken
};


