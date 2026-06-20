// src/middleware/roles.js

exports.onlyAdminTotal = (req, res, next) => {
  const user = req.user;
  if (!user || (user.rol !== 'admin_total' && user.rol_global !== 'admin_total')) {
    return res.status(403).json({ message: 'Somente admin_total pode acessar' });
  }
  next();
};

exports.allowAdmins = (req, res, next) => {
  const user = req.user;
  if (!user || !['admin_total', 'admin_basic'].includes(user.rol)) {
    return res.status(403).json({ message: 'Somente administradores podem acessar' });
  }
  next();
};
