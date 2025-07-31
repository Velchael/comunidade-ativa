const jwt = require('jsonwebtoken');
require('dotenv').config();

exports.authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'Token requerido' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ message: 'Token inválido o expirado' });
  }
};

exports.verifyAdminTotal = (req, res, next) => {
  const user = req.user;
  if (user?.rol === 'admin_total') return next();
  res.status(403).json({ message: 'Acceso denegado' });
};
