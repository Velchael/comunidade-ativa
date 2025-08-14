// src/middleware/permisoSoloAdmins.js
module.exports = (req, res, next) => {
  if (!['admin_basic', 'admin_total'].includes(req.user.rol)) {
    return res.status(403).json({ message: 'Acceso denegado: solo administradores' });
  }
  next();
};

