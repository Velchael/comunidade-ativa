const router = require("express").Router();
const controller = require("../controllers/respuestasController");
const { verificarToken } = require("../middleware/authMiddleware");
const verificarRolComunidad = require("../middleware/verificarRolComunidad");
const db = require("../models");

const getInteraccionComunidadId = async (req) => {
  const interaccion = await db.Interaccion.findByPk(req.body?.interaccion_id, {
    attributes: ["id", "comunidad_id", "visibilidad"]
  });

  if (interaccion?.visibilidad === "global") {
    if (req.user?.comunidad_id) {
      return req.user.comunidad_id;
    }

    const membresia = await db.ComunidadMiembro.findOne({
      where: { user_id: req.user?.id, estado: "activo" },
      attributes: ["comunidad_id"]
    });

    return membresia?.comunidad_id;
  }

  return interaccion?.comunidad_id;
};

const allowCrearRespuesta = verificarRolComunidad({
  rolesPermitidos: ["admin_total", "admin_basic", "miembro"],
  getComunidadId: getInteraccionComunidadId,
  permitirAdminTotalGlobal: true
});

const cargarRespuesta = async (req, res, next) => {
  try {
    const respuesta = await db.Respuesta.findByPk(req.params?.id, {
      attributes: ["id", "interaccion_id", "estado", "user_id"],
      include: [
        {
          model: db.Interaccion,
          as: "interaccion",
          attributes: ["id", "comunidad_id"]
        }
      ]
    });

    if (!respuesta) {
      return res.status(404).json({ message: "Respuesta no encontrada" });
    }

    if (!respuesta.interaccion?.comunidad_id) {
      return res.status(400).json({
        message: "No se pudo resolver la comunidad origen de la interacción"
      });
    }

    req.respuestaTarget = respuesta;
    return next();
  } catch (error) {
    console.error("cargarRespuesta error:", error.message);
    return res.status(500).json({ message: "Error cargando respuesta" });
  }
};

const allowModerarRespuesta = verificarRolComunidad({
  rolesPermitidos: ["admin_total", "admin_basic", "moderador"],
  getComunidadId: (req) => req.respuestaTarget?.interaccion?.comunidad_id,
  permitirAdminTotalGlobal: true
});

router.post("/", verificarToken, allowCrearRespuesta, controller.crear);
router.patch("/:id/estado", verificarToken, cargarRespuesta, allowModerarRespuesta, controller.actualizarEstado);

module.exports = router;
