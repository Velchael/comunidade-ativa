
const adminMiddleware = (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    if  (user.rol !== 'admin' && user.rol !== 'administrador') {
      return res.status(403).json({ message: 'Acceso denegado: se requiere rol de administrador' });
    }

    next(); // autorizado
  } catch (error) {
    res.status(500).json({ message: 'Error en verificación de rol', error: error.message });
  }
};

module.exports = adminMiddleware;

