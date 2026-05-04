// src/middlewares/rolMiddleware.js
const { User } = require('../models');

const verificarRol = (rolesPermitidos = []) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'No autorizado' });
      }

      const user = await User.findByPk(userId, {
        include: [
          {
            association: "comunidad"
          }
        ]
      });

      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      if (!rolesPermitidos.includes(user.rol)) {
        return res.status(403).json({ message: 'Acceso denegado: permisos insuficientes' });
      }

      req.usuarioLogado = user;

      next();
    } catch (err) {
      console.error('❌ Error en verificación de rol:', err);
      res.status(500).json({ message: 'Error interno en permisos' });
    }
  };
};

module.exports = { verificarRol };