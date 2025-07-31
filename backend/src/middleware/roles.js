// src/middleware/roles.js

exports.onlyAdminTotal = (req, res, next) => {
  const user = req.user;
  if (!user || user.rol !== 'admin_total') {
    return res.status(403).json({ message: 'Solo admin_total puede acceder' });
  }
  next();
};

exports.allowAdmins = (req, res, next) => {
  const user = req.user;
  if (!user || !['admin_total', 'admin_basic'].includes(user.rol)) {
    return res.status(403).json({ message: 'Solo administradores pueden acceder' });
  }
  next();
};
