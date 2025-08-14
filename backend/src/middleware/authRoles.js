// middlewares/authRoles.js
module.exports = {
  esAdminTotal: (req, res, next) => {
    if (req.user.rol === 'admin_total') return next();
    return res.status(403).json({ message: 'No autorizado (admin_total requerido)' });
  },

  esAdminComunidad: (req, res, next) => {
    if (['admin_total', 'admin_basic'].includes(req.user.rol)) return next();
    return res.status(403).json({ message: 'No autorizado (admin_basic requerido)' });
  },

  puedeGestionarGrupo: async (req, res, next) => {
    const { GrupoActivo, Usuario } = require('../models');
    const grupoId = req.params.id;
    const grupo = await GrupoActivo.findByPk(grupoId);

    if (!grupo) return res.status(404).json({ message: 'Grupo no encontrado' });

    const mismoAdminComunidad = req.user.rol === 'admin_basic' && grupo.comunidad_id === req.user.comunidad_id;
    const esAdminTotal = req.user.rol === 'admin_total';

    if (esAdminTotal || mismoAdminComunidad) return next();

    return res.status(403).json({ message: 'No tienes permiso para modificar este grupo' });
  }
};
