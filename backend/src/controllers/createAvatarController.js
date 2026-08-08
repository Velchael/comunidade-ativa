const createAvatarController = ({
  User,
  sequelize,
  s3Service,
  buildUserProfileResponse,
  profileQuery,
  logger = console
}) => {
  const tryDeleteAvatar = async ({ key, userId, context }) => {
    try {
      await s3Service.deleteUserAvatar({ key, userId });
      return true;
    } catch (error) {
      logger.error(`❌ Falha ao remover avatar S3 (${context}):`, error);
      return false;
    }
  };

  const uploadMyAvatar = async (req, res) => {
    const userId = req.user?.id;
    if (!Number.isInteger(Number(userId)) || Number(userId) <= 0) {
      return res.status(401).json({ message: 'Não autenticado' });
    }

    let initialUser;
    try {
      initialUser = await User.findByPk(userId, { attributes: ['id', 'foto_perfil'] });
    } catch (error) {
      logger.error('❌ Erro ao consultar usuário antes do upload:', error);
      return res.status(500).json({ message: 'Erro ao consultar perfil' });
    }

    if (!initialUser) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    let previousPhoto = initialUser.foto_perfil || null;
    let newKey;
    try {
      const uploadResult = await s3Service.uploadUserAvatar({
        userId,
        buffer: req.avatar.buffer,
        contentType: req.avatar.contentType,
        extension: req.avatar.extension
      });
      newKey = uploadResult.key;
    } catch (error) {
      logger.error('❌ Erro ao enviar avatar para S3:', error);

      if (error.code === 'S3_CONFIG_ERROR') {
        return res.status(503).json({ message: 'Armazenamento de mídia não configurado' });
      }

      if (error.code === 'INVALID_AUTHENTICATED_USER') {
        return res.status(401).json({ message: 'Não autenticado' });
      }

      return res.status(502).json({ message: 'Não foi possível armazenar o avatar' });
    }

    try {
      previousPhoto = await sequelize.transaction(async (transaction) => {
        const lockedUser = await User.findByPk(userId, {
          transaction,
          lock: transaction.LOCK.UPDATE
        });

        if (!lockedUser) {
          const error = new Error('Usuário não encontrado após o upload');
          error.code = 'USER_NOT_FOUND_AFTER_UPLOAD';
          throw error;
        }

        const lockedPreviousPhoto = lockedUser.foto_perfil || null;
        await lockedUser.update(
          { foto_perfil: newKey },
          { transaction, fields: ['foto_perfil'] }
        );
        return lockedPreviousPhoto;
      });
    } catch (error) {
      logger.error('❌ Erro ao persistir avatar no perfil:', error);
      await tryDeleteAvatar({
        key: newKey,
        userId,
        context: 'compensação de falha RDS'
      });

      if (error.code === 'USER_NOT_FOUND_AFTER_UPLOAD') {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      return res.status(500).json({ message: 'Não foi possível atualizar o perfil' });
    }

    let responseBody;
    try {
      const updatedUser = await User.findByPk(userId, profileQuery);
      if (!updatedUser) {
        logger.error('❌ Usuário não encontrado ao hidratar perfil atualizado');
        return res.status(500).json({ message: 'Erro ao carregar perfil atualizado' });
      }
      responseBody = await buildUserProfileResponse(updatedUser);
    } catch (error) {
      logger.error('❌ Erro ao hidratar perfil após atualizar avatar:', error);
      return res.status(500).json({ message: 'Erro ao carregar perfil atualizado' });
    }

    if (
      previousPhoto
      && s3Service.isManagedAvatar({ key: previousPhoto, userId })
      && previousPhoto !== newKey
    ) {
      await tryDeleteAvatar({
        key: previousPhoto,
        userId,
        context: 'limpeza do avatar anterior'
      });
    }

    return res.status(200).json(responseBody);
  };

  return { uploadMyAvatar };
};

module.exports = { createAvatarController };
