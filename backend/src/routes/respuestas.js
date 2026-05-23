const router = require("express").Router();
const controller = require("../controllers/respuestasController");
const { verificarToken } = require("../middleware/authMiddleware");

router.post("/", verificarToken, controller.crear);

module.exports = router;