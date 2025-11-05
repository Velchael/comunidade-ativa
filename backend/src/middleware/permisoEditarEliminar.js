// backend/middleware/permisoEditarEliminar.js
const db = require('../models');

module.exports = async (req, res, next) => {
  try {
    const grupoId = req.params.id;
    const grupo = await db.GrupoActivo.findByPk(grupoId);
    if (!grupo) return res.status(404).json({ message: 'Grupo no encontrado' });

    if (req.user.rol === 'admin_total') {
      return next();
    }

    if (req.user.rol === 'admin_basic') {
      if (grupo.comunidad_id === req.user.comunidad_id) return next();
      return res.status(403).json({ message: 'No puedes modificar grupos de otra comunidad' });
    }

    // miembros u otros roles
    return res.status(403).json({ message: 'No tienes permiso' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error en verificación de permisos' });
  }
};
