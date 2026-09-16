const { Op, UniqueConstraintError, fn, col, QueryTypes } = require('sequelize');
const db = require('../models');
const notificationDeliveryService = require('../services/notificationDeliveryService');
const { resolveProfilePhoto } = require('../utils/resolveProfilePhoto');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_CORPO_LENGTH = 2000;
const CONVERSA_UNIQUE_CONSTRAINT = 'conversas_privadas_comunidad_participantes_key';
const PRIVATE_MESSAGE_NOTIFICATION_TYPE = 'mensagem_privada';
const PRIVATE_MESSAGE_NOTIFICATION_TITLE = 'Nova mensagem privada';

const normalizeId = (value) => {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
};

const parseLimit = (value) => {
  if (value === undefined || value === null || value === '') return DEFAULT_LIMIT;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createHttpError(400, 'limit deve ser um inteiro positivo');
  }
  return Math.min(parsed, MAX_LIMIT);
};

const parseOptionalIdParam = (value, fieldName) => {
  if (value === undefined || value === null || value === '') return null;
  const id = normalizeId(value);
  if (!id) throw createHttpError(400, `${fieldName} deve ser um inteiro positivo`);
  return id;
};

const orderedParticipants = (firstUserId, secondUserId) => {
  const first = normalizeId(firstUserId);
  const second = normalizeId(secondUserId);
  if (!first || !second) return null;

  return first < second
    ? { participante_1_id: first, participante_2_id: second }
    : { participante_1_id: second, participante_2_id: first };
};

const serializeUser = async (user, photoResolver = resolveProfilePhoto) => {
  const plain = typeof user?.toJSON === 'function' ? user.toJSON() : user;
  if (!plain) return null;
  return {
    id: plain.id,
    username: plain.username,
    foto_perfil: await photoResolver(plain.foto_perfil),
  };
};

const serializeComunidad = (comunidad) => {
  const plain = typeof comunidad?.toJSON === 'function' ? comunidad.toJSON() : comunidad;
  if (!plain) return null;
  return {
    id: plain.id,
    nombre_comunidad: plain.nombre_comunidad,
  };
};

const serializeMensagem = (mensagem) => {
  const plain = typeof mensagem?.toJSON === 'function' ? mensagem.toJSON() : mensagem;
  if (!plain) return null;
  return {
    id: plain.id,
    conversa_id: plain.conversa_id,
    sender_user_id: plain.sender_user_id,
    corpo: plain.corpo,
    read_at: plain.read_at || null,
    created_at: plain.created_at,
  };
};

const serializeConversa = async ({
  conversa,
  currentUserId,
  ultimoMensagem = null,
  unreadCount = 0,
  canSend = false,
  photoResolver = resolveProfilePhoto,
}) => {
  const plain = typeof conversa?.toJSON === 'function' ? conversa.toJSON() : conversa;
  const otherUser = Number(plain.participante_1_id) === Number(currentUserId)
    ? plain.participante2
    : plain.participante1;

  return {
    id: plain.id,
    comunidad: serializeComunidad(plain.comunidad),
    outro_participante: await serializeUser(otherUser, photoResolver),
    last_message_at: plain.last_message_at || null,
    ultimo_mensagem: serializeMensagem(ultimoMensagem),
    unread_count: unreadCount,
    can_send: canSend,
  };
};

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeCorpo = (value) => {
  if (typeof value !== 'string') return null;
  const corpo = value.trim();
  if (!corpo) return null;
  if (corpo.length > MAX_CORPO_LENGTH) return false;
  return corpo;
};

const getActorFirstName = (user) => {
  const source = typeof user?.username === 'string' && user.username.trim()
    ? user.username
    : user?.email;
  if (typeof source !== 'string' || !source.trim()) return 'Alguém';
  return source.trim().split(/\s+/)[0].slice(0, 80) || 'Alguém';
};

const buildPrivateMessageNotification = ({ conversa, actorUser }) => {
  const plain = typeof conversa?.toJSON === 'function' ? conversa.toJSON() : conversa;
  const actorUserId = normalizeId(actorUser?.id);
  const participante1Id = normalizeId(plain?.participante_1_id);
  const participante2Id = normalizeId(plain?.participante_2_id);
  const recipientUserId = actorUserId === participante1Id ? participante2Id : participante1Id;

  if (!actorUserId || !recipientUserId || recipientUserId === actorUserId) return null;

  return {
    user_id: recipientUserId,
    actor_user_id: actorUserId,
    tipo: PRIVATE_MESSAGE_NOTIFICATION_TYPE,
    interaccion_id: null,
    respuesta_id: null,
    comunidad_id: normalizeId(plain.comunidad_id),
    task_id: null,
    titulo: PRIVATE_MESSAGE_NOTIFICATION_TITLE,
    corpo: `${getActorFirstName(actorUser)} enviou uma mensagem.`,
    url: `/conversas/${plain.id}`,
    leida: false,
  };
};

const hasExpectedFields = (fields) => {
  const expected = ['comunidad_id', 'participante_1_id', 'participante_2_id'];
  const names = Array.isArray(fields)
    ? fields.map((field) => String(field))
    : Object.keys(fields || {});

  return expected.every((field) => names.includes(field));
};

const isExpectedConversaUniqueError = (error) => {
  if (!(error instanceof UniqueConstraintError || error?.name === 'SequelizeUniqueConstraintError')) {
    return false;
  }

  const constraint = error.constraint || error.parent?.constraint || error.original?.constraint;
  if (constraint) return constraint === CONVERSA_UNIQUE_CONSTRAINT;

  if (hasExpectedFields(error.fields)) return true;

  const errorFields = (error.errors || [])
    .map((item) => item?.path || item?.properties?.path)
    .filter(Boolean);
  return hasExpectedFields(errorFields);
};

const createConversasController = ({
  ConversaPrivada = db.ConversaPrivada,
  ConversaMensagem = db.ConversaMensagem,
  Comunidad = db.Comunidad,
  ComunidadMiembro = db.ComunidadMiembro,
  User = db.User,
  Interaccion = db.Interaccion,
  Respuesta = db.Respuesta,
  Notificacion = db.Notificacion,
  sequelize = db.sequelize,
  deliveryService = notificationDeliveryService,
  photoResolver = resolveProfilePhoto,
  logger = console,
} = {}) => {
  const loadConversaForUser = async (conversaId, userId, options = {}) => {
    const id = normalizeId(conversaId);
    const currentUserId = normalizeId(userId);
    if (!id || !currentUserId) return null;

    return ConversaPrivada.findOne({
      where: {
        id,
        [Op.or]: [
          { participante_1_id: currentUserId },
          { participante_2_id: currentUserId },
        ],
      },
      ...options,
    });
  };

  const checkCanSend = async (conversa, options = {}) => {
    const plain = typeof conversa?.toJSON === 'function' ? conversa.toJSON() : conversa;
    const comunidadId = normalizeId(plain?.comunidad_id);
    const participante1Id = normalizeId(plain?.participante_1_id);
    const participante2Id = normalizeId(plain?.participante_2_id);

    if (!comunidadId || !participante1Id || !participante2Id) return false;

    const comunidad = await Comunidad.findByPk(comunidadId, {
      attributes: ['id', 'activa'],
      transaction: options.transaction,
    });
    if (!comunidad || comunidad.activa !== true) return false;

    const memberships = await ComunidadMiembro.findAll({
      where: {
        user_id: { [Op.in]: [participante1Id, participante2Id] },
        comunidad_id: comunidadId,
        estado: 'activo',
      },
      attributes: ['user_id', 'comunidad_id', 'estado'],
      transaction: options.transaction,
    });
    const activeUserIds = new Set(memberships.map((membership) => Number(membership.user_id)));

    return activeUserIds.has(participante1Id) && activeUserIds.has(participante2Id);
  };

  const resolveOrigin = async ({ originInteraccionId, originRespuestaId, targetUserId, comunidadId }) => {
    const normalizedOriginRespuestaId = normalizeId(originRespuestaId);
    const normalizedOriginInteraccionId = normalizeId(originInteraccionId);
    const normalizedTargetUserId = normalizeId(targetUserId);
    const normalizedComunidadId = normalizeId(comunidadId);

    if (normalizedOriginRespuestaId) {
      const respuesta = await Respuesta.findByPk(normalizedOriginRespuestaId, {
        attributes: ['id', 'interaccion_id', 'user_id'],
        include: [
          {
            model: Interaccion,
            as: 'interaccion',
            attributes: ['id', 'comunidad_id'],
          },
        ],
      });

      if (!respuesta) throw createHttpError(404, 'Resposta de origem não encontrada');
      const resolvedTargetUserId = normalizeId(respuesta.user_id);
      const resolvedInteraccionId = normalizeId(respuesta.interaccion_id);
      const resolvedComunidadId = normalizeId(respuesta.interaccion?.comunidad_id);

      if (!resolvedTargetUserId || !resolvedInteraccionId || !resolvedComunidadId) {
        throw createHttpError(400, 'Origem inválida para conversa privada');
      }
      if (normalizedTargetUserId && normalizedTargetUserId !== resolvedTargetUserId) {
        throw createHttpError(400, 'target_user_id não corresponde à resposta de origem');
      }
      if (normalizedOriginInteraccionId && normalizedOriginInteraccionId !== resolvedInteraccionId) {
        throw createHttpError(400, 'origin_interaccion_id não corresponde à resposta de origem');
      }
      if (normalizedComunidadId && normalizedComunidadId !== resolvedComunidadId) {
        throw createHttpError(400, 'comunidad_id não corresponde à origem');
      }

      return {
        targetUserId: resolvedTargetUserId,
        comunidadId: resolvedComunidadId,
        originInteraccionId: resolvedInteraccionId,
      };
    }

    if (normalizedOriginInteraccionId) {
      const interaccion = await Interaccion.findByPk(normalizedOriginInteraccionId, {
        attributes: ['id', 'user_id', 'comunidad_id'],
      });

      if (!interaccion) throw createHttpError(404, 'Interação de origem não encontrada');
      const resolvedTargetUserId = normalizeId(interaccion.user_id);
      const resolvedComunidadId = normalizeId(interaccion.comunidad_id);

      if (!resolvedTargetUserId || !resolvedComunidadId) {
        throw createHttpError(400, 'Origem inválida para conversa privada');
      }
      if (normalizedTargetUserId && normalizedTargetUserId !== resolvedTargetUserId) {
        throw createHttpError(400, 'target_user_id não corresponde à interação de origem');
      }
      if (normalizedComunidadId && normalizedComunidadId !== resolvedComunidadId) {
        throw createHttpError(400, 'comunidad_id não corresponde à origem');
      }

      return {
        targetUserId: resolvedTargetUserId,
        comunidadId: resolvedComunidadId,
        originInteraccionId: normalizedOriginInteraccionId,
      };
    }

    return {
      targetUserId: normalizedTargetUserId,
      comunidadId: normalizedComunidadId,
      originInteraccionId: null,
    };
  };

  const inferComunidadIdForDirectTarget = async ({ actorUserId, targetUserId, requestedComunidadId }) => {
    if (requestedComunidadId) return requestedComunidadId;

    const memberships = await ComunidadMiembro.findAll({
      where: {
        user_id: { [Op.in]: [actorUserId, targetUserId] },
        estado: 'activo',
      },
      attributes: ['user_id', 'comunidad_id'],
      order: [['comunidad_id', 'ASC'], ['user_id', 'ASC']],
    });

    const actorCommunities = new Set(
      memberships
        .filter((membership) => Number(membership.user_id) === Number(actorUserId))
        .map((membership) => normalizeId(membership.comunidad_id))
        .filter(Boolean)
    );
    const shared = memberships
      .filter((membership) => Number(membership.user_id) === Number(targetUserId))
      .map((membership) => normalizeId(membership.comunidad_id))
      .find((id) => actorCommunities.has(id));

    return shared || null;
  };

  const authorizePair = async ({ actorUserId, targetUserId, comunidadId }) => {
    const actorId = normalizeId(actorUserId);
    const targetId = normalizeId(targetUserId);
    const normalizedComunidadId = normalizeId(comunidadId);

    if (!actorId) throw createHttpError(401, 'Não autenticado');
    if (!targetId) throw createHttpError(400, 'target_user_id válido é obrigatório');
    if (actorId === targetId) throw createHttpError(400, 'Não é possível criar conversa consigo mesmo');

    const targetUser = await User.findByPk(targetId, {
      attributes: ['id', 'username', 'foto_perfil'],
    });
    if (!targetUser) throw createHttpError(404, 'Usuário destinatário não encontrado');

    const finalComunidadId = await inferComunidadIdForDirectTarget({
      actorUserId: actorId,
      targetUserId: targetId,
      requestedComunidadId: normalizedComunidadId,
    });
    if (!finalComunidadId) throw createHttpError(403, 'Usuários não compartilham comunidade ativa');

    const comunidad = await Comunidad.findByPk(finalComunidadId, {
      attributes: ['id', 'nombre_comunidad', 'activa'],
    });
    if (!comunidad) throw createHttpError(404, 'Comunidade não encontrada');
    if (comunidad.activa !== true) throw createHttpError(403, 'Comunidade inativa');

    const memberships = await ComunidadMiembro.findAll({
      where: {
        user_id: { [Op.in]: [actorId, targetId] },
        comunidad_id: finalComunidadId,
        estado: 'activo',
      },
      attributes: ['user_id', 'comunidad_id', 'estado'],
    });
    const activeUserIds = new Set(memberships.map((membership) => Number(membership.user_id)));

    if (!activeUserIds.has(actorId)) throw createHttpError(403, 'Você não pertence ativamente a esta comunidade');
    if (!activeUserIds.has(targetId)) throw createHttpError(403, 'Destinatário não pertence ativamente a esta comunidade');

    return {
      comunidad,
      targetUser,
      comunidadId: finalComunidadId,
      participants: orderedParticipants(actorId, targetId),
    };
  };

  const findExistingConversa = async ({ comunidadId, participants }) => ConversaPrivada.findOne({
    where: {
      comunidad_id: comunidadId,
      participante_1_id: participants.participante_1_id,
      participante_2_id: participants.participante_2_id,
    },
  });

  const getOrCreateConversa = async ({ comunidadId, participants, originInteraccionId }) => {
    const existing = await findExistingConversa({ comunidadId, participants });
    if (existing) return existing;

    try {
      return await ConversaPrivada.create({
        comunidad_id: comunidadId,
        participante_1_id: participants.participante_1_id,
        participante_2_id: participants.participante_2_id,
        origin_interaccion_id: originInteraccionId || null,
        last_message_at: null,
      });
    } catch (error) {
      if (isExpectedConversaUniqueError(error)) {
        const concurrent = await findExistingConversa({ comunidadId, participants });
        if (concurrent) return concurrent;
      }
      throw error;
    }
  };

  const criarOuObter = async (req, res) => {
    try {
      const actorUserId = req.user?.id;
      const origin = await resolveOrigin({
        originInteraccionId: req.body?.origin_interaccion_id,
        originRespuestaId: req.body?.origin_respuesta_id,
        targetUserId: req.body?.target_user_id,
        comunidadId: req.body?.comunidad_id,
      });
      const auth = await authorizePair({
        actorUserId,
        targetUserId: origin.targetUserId,
        comunidadId: origin.comunidadId,
      });

      const conversa = await getOrCreateConversa({
        comunidadId: auth.comunidadId,
        participants: auth.participants,
        originInteraccionId: origin.originInteraccionId,
      });

      return res.status(200).json({
        id: conversa.id,
        comunidad: serializeComunidad(auth.comunidad),
        outro_participante: await serializeUser(auth.targetUser, photoResolver),
        last_message_at: conversa.last_message_at || null,
      });
    } catch (error) {
      const status = error.status || 500;
      if (status >= 500) logger.error?.('criar conversa error:', error.message);
      return res.status(status).json({
        message: status >= 500 ? 'Erro ao criar conversa privada' : error.message,
      });
    }
  };

  const listar = async (req, res) => {
    try {
      const userId = normalizeId(req.user?.id);
      if (!userId) return res.status(401).json({ message: 'Não autenticado' });

      const limit = parseLimit(req.query?.limit);
      const conversas = await ConversaPrivada.findAll({
        where: {
          [Op.or]: [
            { participante_1_id: userId },
            { participante_2_id: userId },
          ],
        },
        include: [
          {
            model: Comunidad,
            as: 'comunidad',
            attributes: ['id', 'nombre_comunidad', 'activa'],
          },
          {
            model: User,
            as: 'participante1',
            attributes: ['id', 'username', 'foto_perfil'],
          },
          {
            model: User,
            as: 'participante2',
            attributes: ['id', 'username', 'foto_perfil'],
          },
        ],
        order: [
          ['last_message_at', 'DESC'],
          ['updated_at', 'DESC'],
          ['id', 'DESC'],
        ],
        limit,
      });

      const conversaIds = conversas.map((conversa) => normalizeId(conversa.id)).filter(Boolean);
      const latestByConversaId = new Map();
      const unreadByConversaId = new Map();
      const canSendByConversaId = new Map();

      if (conversaIds.length > 0) {
        const latestMessages = typeof sequelize.query === 'function'
          ? await sequelize.query(
            `
              SELECT DISTINCT ON (conversa_id)
                id, conversa_id, sender_user_id, corpo, read_at, created_at
              FROM conversa_mensagens
              WHERE conversa_id IN (:conversaIds)
              ORDER BY conversa_id, id DESC
            `,
            {
              replacements: { conversaIds },
              type: QueryTypes.SELECT,
            }
          )
          : [];

        for (const message of latestMessages) {
          const conversaId = normalizeId(message.conversa_id);
          if (conversaId && !latestByConversaId.has(conversaId)) {
            latestByConversaId.set(conversaId, message);
          }
        }

        const unreadRows = await ConversaMensagem.findAll({
          where: {
            conversa_id: { [Op.in]: conversaIds },
            sender_user_id: { [Op.ne]: userId },
            read_at: null,
          },
          attributes: [
            'conversa_id',
            [fn('COUNT', col('id')), 'unread_count'],
          ],
          group: ['conversa_id'],
        });

        for (const row of unreadRows) {
          const plain = typeof row?.toJSON === 'function' ? row.toJSON() : row;
          const conversaId = normalizeId(plain.conversa_id);
          unreadByConversaId.set(conversaId, Number(plain.unread_count) || 0);
        }

        const participantIds = [...new Set(conversas.flatMap((conversa) => [
          normalizeId(conversa.participante_1_id),
          normalizeId(conversa.participante_2_id),
        ]).filter(Boolean))];
        const comunidadIds = [...new Set(conversas.map((conversa) => normalizeId(conversa.comunidad_id)).filter(Boolean))];
        const activeMemberships = await ComunidadMiembro.findAll({
          where: {
            user_id: { [Op.in]: participantIds },
            comunidad_id: { [Op.in]: comunidadIds },
            estado: 'activo',
          },
          attributes: ['user_id', 'comunidad_id', 'estado'],
        });
        const activeMembershipKeys = new Set(activeMemberships.map((membership) => (
          `${normalizeId(membership.comunidad_id)}:${normalizeId(membership.user_id)}`
        )));

        for (const conversa of conversas) {
          const plain = typeof conversa?.toJSON === 'function' ? conversa.toJSON() : conversa;
          const comunidadeAtiva = plain.comunidad?.activa === true;
          const p1Active = activeMembershipKeys.has(`${plain.comunidad_id}:${plain.participante_1_id}`);
          const p2Active = activeMembershipKeys.has(`${plain.comunidad_id}:${plain.participante_2_id}`);
          canSendByConversaId.set(normalizeId(plain.id), comunidadeAtiva && p1Active && p2Active);
        }
      }

      return res.json({
        items: await Promise.all(conversas.map((conversa) => serializeConversa({
          conversa,
          currentUserId: userId,
          ultimoMensagem: latestByConversaId.get(normalizeId(conversa.id)) || null,
          unreadCount: unreadByConversaId.get(normalizeId(conversa.id)) || 0,
          canSend: canSendByConversaId.get(normalizeId(conversa.id)) === true,
          photoResolver,
        }))),
      });
    } catch (error) {
      const status = error.status || 500;
      if (status < 500) return res.status(status).json({ message: error.message });
      logger.error?.('listar conversas error:', error.message);
      return res.status(500).json({ message: 'Erro ao listar conversas privadas' });
    }
  };

  const listarMensagens = async (req, res) => {
    try {
      const userId = normalizeId(req.user?.id);
      if (!userId) return res.status(401).json({ message: 'Não autenticado' });

      const conversa = await loadConversaForUser(req.params?.id, userId);
      if (!conversa) return res.status(403).json({ message: 'Conversa privada não encontrada ou sem permissão' });

      const limit = parseLimit(req.query?.limit);
      const afterId = parseOptionalIdParam(req.query?.after_id, 'after_id');
      const beforeId = parseOptionalIdParam(req.query?.before_id, 'before_id');
      if (afterId && beforeId) {
        return res.status(400).json({ message: 'after_id e before_id não podem ser usados juntos' });
      }
      const idCondition = afterId
        ? { [Op.gt]: afterId }
        : (beforeId ? { [Op.lt]: beforeId } : null);
      const where = { conversa_id: conversa.id };
      if (idCondition) where.id = idCondition;

      const mensagens = await ConversaMensagem.findAll({
        where,
        order: [['id', afterId ? 'ASC' : 'DESC']],
        limit,
      });
      const ordered = afterId ? mensagens : [...mensagens].reverse();

      return res.json({
        items: ordered.map(serializeMensagem),
        limit,
      });
    } catch (error) {
      const status = error.status || 500;
      if (status < 500) return res.status(status).json({ message: error.message });
      logger.error?.('listar mensagens conversa error:', error.message);
      return res.status(500).json({ message: 'Erro ao listar mensagens da conversa' });
    }
  };

  const enviarMensagem = async (req, res) => {
    let transaction;
    let notificacion = null;

    try {
      const userId = normalizeId(req.user?.id);
      if (!userId) return res.status(401).json({ message: 'Não autenticado' });

      transaction = await sequelize.transaction();
      const conversa = await loadConversaForUser(req.params?.id, userId, { transaction });
      if (!conversa) {
        await transaction.rollback();
        transaction = null;
        return res.status(403).json({ message: 'Conversa privada não encontrada ou sem permissão' });
      }
      const canSend = await checkCanSend(conversa, { transaction });
      if (!canSend) {
        await transaction.rollback();
        transaction = null;
        return res.status(403).json({ message: 'Conversa privada não está habilitada para novas mensagens' });
      }

      const corpo = normalizeCorpo(req.body?.corpo);
      if (corpo === null) {
        await transaction.rollback();
        transaction = null;
        return res.status(400).json({ message: 'Mensagem não pode estar vazia' });
      }
      if (corpo === false) {
        await transaction.rollback();
        transaction = null;
        return res.status(400).json({
          message: `Mensagem deve ter no máximo ${MAX_CORPO_LENGTH} caracteres`,
        });
      }

      const mensagem = await ConversaMensagem.create({
        conversa_id: conversa.id,
        sender_user_id: userId,
        corpo,
        read_at: null,
      }, { transaction });

      const messageCreatedAt = mensagem.created_at || new Date();
      await conversa.update({ last_message_at: messageCreatedAt }, { transaction });

      const notificationPayload = buildPrivateMessageNotification({
        conversa,
        actorUser: req.user,
      });

      if (notificationPayload) {
        notificacion = await Notificacion.create(notificationPayload, { transaction });
      }

      await transaction.commit();
      transaction = null;

      if (notificacion) {
        try {
          await deliveryService.deliver(notificacion);
        } catch (deliveryError) {
          logger.error?.('post-commit private message notification delivery error');
        }
      }

      return res.status(201).json(serializeMensagem(mensagem));
    } catch (error) {
      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          logger.error?.('enviar mensagem rollback error:', rollbackError.message);
        }
      }

      logger.error?.('enviar mensagem conversa error:', error.message);
      return res.status(500).json({ message: 'Erro ao enviar mensagem' });
    }
  };

  const marcarLida = async (req, res) => {
    try {
      const userId = normalizeId(req.user?.id);
      if (!userId) return res.status(401).json({ message: 'Não autenticado' });

      const conversa = await loadConversaForUser(req.params?.id, userId);
      if (!conversa) return res.status(403).json({ message: 'Conversa privada não encontrada ou sem permissão' });

      const [updated] = await ConversaMensagem.update(
        { read_at: new Date() },
        {
          where: {
            conversa_id: conversa.id,
            sender_user_id: { [Op.ne]: userId },
            read_at: null,
          },
        }
      );

      return res.json({
        conversa_id: conversa.id,
        marked_read: updated,
      });
    } catch (error) {
      logger.error?.('marcar conversa lida error:', error.message);
      return res.status(500).json({ message: 'Erro ao marcar conversa como lida' });
    }
  };

  return {
    criarOuObter,
    listar,
    listarMensagens,
    enviarMensagem,
    marcarLida,
    authorizePair,
    checkCanSend,
    orderedParticipants,
    buildPrivateMessageNotification,
    parseLimit,
    normalizeCorpo,
    MAX_CORPO_LENGTH,
    MAX_LIMIT,
  };
};

module.exports = {
  ...createConversasController(),
  createConversasController,
  orderedParticipants,
  parseLimit,
  normalizeCorpo,
  isExpectedConversaUniqueError,
  buildPrivateMessageNotification,
  PRIVATE_MESSAGE_NOTIFICATION_TYPE,
  PRIVATE_MESSAGE_NOTIFICATION_TITLE,
  MAX_CORPO_LENGTH,
  MAX_LIMIT,
};
