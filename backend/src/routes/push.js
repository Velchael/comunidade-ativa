const router = require('express').Router();
const controller = require('../controllers/pushSubscriptionsController');
const configController = require('../controllers/pushConfigController');
const { verificarToken } = require('../middleware/authMiddleware');

router.get('/vapid-public-key', configController.getVapidPublicKey);
router.post('/subscriptions', verificarToken, controller.subscribe);
router.delete('/subscriptions', verificarToken, controller.unsubscribe);

module.exports = router;
