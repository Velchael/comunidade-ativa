const pool = require('../db/pool');

const adminMiddleware = async (req, res, next) => {
  try {
    const { email } = req.user;
    const result = await pool.query('SELECT rol FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });

    if (result.rows[0].rol !== 'admin') {
      return res.status(403).json({ message: 'Acceso denegado: se requiere rol de administrador' });
    }

    next();
  } catch (err) {
    return res.status(500).json({ message: 'Error de autorización', error: err.message });
  }
};

module.exports = adminMiddleware;

