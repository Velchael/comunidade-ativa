const { Reporte, GrupoActivo } = require('../models');

module.exports = {
  // ✅ Ver reportes
  puedeVer: async (req, res, next) => {
    try {
      const user = req.user;
      const { grupoId, reporteId } = req.params;

      let reporte = null;

      if (reporteId) {
        reporte = await Reporte.findByPk(reporteId);
        if (!reporte) {
          return res.status(404).json({ error: 'Reporte no encontrado' });
        }
      }

      // Admin siempre puede
      if (user.rol === 'admin_basic' || user.rol === 'admin_total') {
        return next();
      }

      // Si es miembro, buscar si es líder de ese grupo
      const grupo = await GrupoActivo.findOne({ where: { id: grupoId || (reporte && reporte.grupo_id) } });

      if (!grupo) {
        return res.status(404).json({ error: 'Grupo no encontrado' });
      }

      if (grupo.lider_id !== user.id) {
        return res.status(403).json({ error: 'No puedes ver reportes de otros grupos' });
      }

      return next();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error en permisos' });
    }
  },

  // ✅ Crear/editar reportes
  puedeCrearEditar: async (req, res, next) => {
    try {
      const user = req.user;
      const { grupoId } = req.params;

      if (user.rol === 'admin_basic' || user.rol === 'admin_total') {
        return next();
      }

      const grupo = await GrupoActivo.findByPk(grupoId);

      if (!grupo) {
        return res.status(404).json({ error: 'Grupo no encontrado' });
      }

      // Solo el líder de ese grupo puede crear reportes
      if (user.rol === 'miembro' && grupo.lider_id === user.id) {
        return next();
      }

      return res.status(403).json({ error: 'No tienes permisos para crear/editar' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error en permisos' });
    }
  },

  // ✅ Eliminar reportes
  puedeEliminar: (req, res, next) => {
    const user = req.user;
    if (user.rol === 'admin_total') {
      return next();
    }
    return res.status(403).json({ error: 'Solo admin puede eliminar reportes' });
  },
};
