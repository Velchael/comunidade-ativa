
// Middleware para que solo admin_basic (su comunidad) o admin_total puedan modificar/eliminar
const db = require('../models');

exports.permisoSoloAdmins = async (req, res, next) => {
  try {
    const { id, rol, comunidad_id } = req.user;

    // Si es admin_total → siempre puede continuar
    if (rol === 'admin_total') {
      return next();
    }

    // Si es admin_basic → debe pertenecer a la misma comunidad del grupo
    if (rol === 'admin_basic') {
      const grupo = await db.Grupo.findByPk(req.params.id);
      if (!grupo) {
        return res.status(404).json({ message: 'Grupo no encontrado' });
      }
      if (grupo.comunidad_id !== comunidad_id) {
        return res.status(403).json({ message: 'No puedes modificar grupos de otra comunidad' });
      }
      return next();
    }

    // Cualquier otro rol → prohibido
    return res.status(403).json({ message: 'No tienes permisos para realizar esta acción' });
  } catch (error) {
    console.error('❌ Error en permisoSoloAdmins:', error);
    res.status(500).json({ message: 'Error en la verificación de permisos' });
  }
};

