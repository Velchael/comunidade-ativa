const { Reporte, GrupoActivo } = require('../models');
const { tieneRolComunidad } = require('../utils/comunidadRoles');

const obtenerGrupoDesdeParams = async (params) => {
  const { grupoId, reporteId } = params;

  if (grupoId) {
    return GrupoActivo.findByPk(grupoId);
  }

  if (reporteId) {
    const reporte = await Reporte.findByPk(reporteId);
    if (!reporte) return null;
    return GrupoActivo.findByPk(reporte.grupo_id);
  }

  return null;
};

const esAdminComunidad = async (user, comunidadId) => {
  if (user.rol === 'admin_total') {
    return true;
  }

  const resultado = await tieneRolComunidad(user, comunidadId, ['admin_total', 'admin_basic']);
  return resultado.permitido;
};

module.exports = {
  // ✅ Ver reportes
  puedeVer: async (req, res, next) => {
    try {
      const user = req.user;
      const grupo = await obtenerGrupoDesdeParams(req.params);

      if (!grupo) {
        return res.status(404).json({ error: 'Grupo no encontrado' });
      }

      if (await esAdminComunidad(user, grupo.comunidad_id)) {
        return next();
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
      const grupo = await obtenerGrupoDesdeParams(req.params);

      if (!grupo) {
        return res.status(404).json({ error: 'Grupo no encontrado' });
      }

      if (await esAdminComunidad(user, grupo.comunidad_id)) {
        return next();
      }

      // Solo el líder de ese grupo puede crear reportes
      if (grupo.lider_id === user.id) {
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
