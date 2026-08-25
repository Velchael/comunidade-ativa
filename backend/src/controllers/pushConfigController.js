const webPushProvider = require('../services/webPushProvider');

const createPushConfigController = ({
  provider = webPushProvider,
  logger = console,
} = {}) => {
  const getVapidPublicKey = (req, res) => {
    try {
      const publicKey = provider.getPublicKey();

      if (!publicKey) {
        return res.status(503).json({
          message: 'Push notifications are not configured',
        });
      }

      return res.json({ publicKey });
    } catch (error) {
      logger.error?.('VAPID public key read error');
      return res.status(500).json({ message: 'Erro ao obter configuração push' });
    }
  };

  return { getVapidPublicKey };
};

module.exports = {
  ...createPushConfigController(),
  createPushConfigController,
};
