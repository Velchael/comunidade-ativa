const router = require("express").Router();
const controller = require("../controllers/notificacionesController");
const { verificarToken } = require("../middleware/authMiddleware");

router.get("/", verificarToken, controller.listar);
router.patch("/:id/leida", verificarToken, controller.marcarLeida);

module.exports = router;
