const router = require("express").Router();
const controller = require("../controllers/interaccionesController");
const { verificarToken } = require("../middleware/authMiddleware");

router.post("/", verificarToken, controller.crear);
router.get("/:comunidad_id", controller.listar);

module.exports = router;