const db = require("../models");

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const parseLimit = (value) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
};

const serializeNotificacion = (notificacion) => {
  const plain = typeof notificacion.toJSON === "function"
    ? notificacion.toJSON()
    : notificacion;

  return {
    id: plain.id,
    tipo: plain.tipo,
    interaccion_id: plain.interaccion_id,
    respuesta_id: plain.respuesta_id,
    comunidad_id: plain.comunidad_id,
    task_id: plain.task_id,
    titulo: plain.titulo,
    corpo: plain.corpo,
    url: plain.url,
    leida: plain.leida,
    created_at: plain.created_at,
    actor: plain.actor
      ? {
          id: plain.actor.id,
          username: plain.actor.username
        }
      : null
  };
};

const createNotificacionesController = ({
  Notificacion = db.Notificacion,
  User = db.User,
  logger = console
} = {}) => {
  const listar = async (req, res) => {
    try {
      const userId = req.user.id;
      const limit = parseLimit(req.query?.limit);

      const items = await Notificacion.findAll({
        where: { user_id: userId },
        attributes: [
          "id",
          "tipo",
          "interaccion_id",
          "respuesta_id",
          "comunidad_id",
          "task_id",
          "titulo",
          "corpo",
          "url",
          "leida",
          "created_at"
        ],
        include: [
          {
            model: User,
            as: "actor",
            attributes: ["id", "username"]
          }
        ],
        order: [
          ["created_at", "DESC"],
          ["id", "DESC"]
        ],
        limit
      });

      const unreadCount = await Notificacion.count({
        where: {
          user_id: userId,
          leida: false
        }
      });

      return res.json({
        items: items.map(serializeNotificacion),
        unread_count: unreadCount
      });
    } catch (err) {
      logger.error?.("listar notificacoes error:", err.message);
      return res.status(500).json({ message: "Erro ao listar notificações" });
    }
  };

  const marcarLeida = async (req, res) => {
    try {
      const notificationId = Number(req.params?.id);

      if (!Number.isInteger(notificationId) || notificationId <= 0) {
        return res.status(400).json({ message: "id de notificação inválido" });
      }

      const [affectedRows] = await Notificacion.update(
        { leida: true },
        {
          where: {
            id: notificationId,
            user_id: req.user.id
          }
        }
      );

      if (affectedRows === 0) {
        return res.status(404).json({ message: "Notificação não encontrada" });
      }

      return res.json({
        id: notificationId,
        leida: true
      });
    } catch (err) {
      logger.error?.("marcar notificacao leida error:", err.message);
      return res.status(500).json({ message: "Erro ao marcar notificação como lida" });
    }
  };

  return { listar, marcarLeida };
};

module.exports = {
  ...createNotificacionesController(),
  createNotificacionesController,
  parseLimit,
  serializeNotificacion
};
