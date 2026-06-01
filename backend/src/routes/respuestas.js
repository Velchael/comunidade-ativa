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

router.post("/", verificarToken, allowCrearRespuesta, controller.crear);

module.exports = router;
