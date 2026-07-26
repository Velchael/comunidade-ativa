// src/middleware/roles.js
const { User } = require('../models');

exports.onlyAdminTotal = async (req, res, next) => {
  const actorId = Number(req.user?.id);

  if (!Number.isInteger(actorId) || actorId <= 0) {
    return res.status(403).json({ message: 'Somente admin_total pode acessar' });
  }

  try {
    const actor = await User.findByPk(actorId, {
      attributes: ['id', 'rol_global']
    });

    if (actor?.rol_global !== 'admin_total') {
      return res.status(403).json({ message: 'Somente admin_total pode acessar' });
    }

    return next();
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao verificar autorização' });
  }
};

exports.allowAdmins = (req, res, next) => {
  const user = req.user;
  if (!user || !['admin_total', 'admin_basic'].includes(user.rol)) {
    return res.status(403).json({ message: 'Somente administradores podem acessar' });
  }
  next();
};
