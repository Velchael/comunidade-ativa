const router = require('express').Router();
const controller = require('../controllers/conversasController');
const { verificarToken } = require('../middleware/authMiddleware');

router.post('/', verificarToken, controller.criarOuObter);
router.get('/', verificarToken, controller.listar);
router.get('/:id/mensagens', verificarToken, controller.listarMensagens);
router.post('/:id/mensagens', verificarToken, controller.enviarMensagem);
router.patch('/:id/lida', verificarToken, controller.marcarLida);

module.exports = router;
