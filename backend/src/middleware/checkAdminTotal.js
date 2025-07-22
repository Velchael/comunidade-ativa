const checkAdminTotal = (req, res, next) => {
  if (req.user.rol !== 'admin_total') {
    return res.status(403).json({ message: 'Solo accesible para administradores totales' });
  }
  next();
};

module.exports = checkAdminTotal;
