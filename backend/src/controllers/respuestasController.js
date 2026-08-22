const db = require("../models");

const ESTADOS_PERMITIDOS = ["activa", "oculta"];

const createRespuestasController = ({
  Respuesta = db.Respuesta,
  Interaccion = db.Interaccion,
  Notificacion = db.Notificacion,
  sequelize = db.sequelize,
  logger = console
} = {}) => {
  const crear = async (req, res) => {
    let transaction;

    try {
      const interaccionId = Number(req.body?.interaccion_id);

      if (!Number.isInteger(interaccionId) || interaccionId <= 0) {
        return res.status(400).json({ message: "interaccion_id válido é obrigatório" });
      }

      transaction = await sequelize.transaction();

      const interaccion = await Interaccion.findByPk(interaccionId, {
        attributes: ["id", "user_id"],
        transaction
      });

      if (!interaccion) {
        await transaction.rollback();
        transaction = null;
        return res.status(404).json({ message: "Interação não encontrada" });
      }

      const actorUserId = req.user.id;
      const recipientUserId = interaccion.user_id;

      const data = await Respuesta.create({
        interaccion_id: interaccion.id,
        user_id: actorUserId,
        mensaje: req.body?.mensaje,
        imagen_url: req.body?.imagen_url,
        estado: req.body?.estado
      }, {
        transaction
      });

      if (Number(recipientUserId) !== Number(actorUserId)) {
        await Notificacion.create({
          user_id: recipientUserId,
          actor_user_id: actorUserId,
          tipo: "respuesta_interaccion",
          interaccion_id: interaccion.id,
          respuesta_id: data.id,
          leida: false
        }, {
          transaction
        });
      }

      await transaction.commit();
      transaction = null;

      return res.json(data);
    } catch (err) {
      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          logger.error?.("crear respuesta rollback error:", rollbackError.message);
        }
      }

      logger.error?.("crear respuesta error:", err.message);
      return res.status(500).json({ message: "Erro ao criar resposta" });
    }
  };

  const actualizarEstado = async (req, res) => {
    try {
      const estado = String(req.body?.estado || "").trim().toLowerCase();

      if (!ESTADOS_PERMITIDOS.includes(estado)) {
        return res.status(400).json({
          message: "estado inválido. Só são permitidos activa ou oculta"
        });
      }

      const respuesta = req.respuestaTarget;

      if (!respuesta) {
        return res.status(404).json({ message: "Resposta não encontrada" });
      }

      const comunidadId = respuesta.interaccion?.comunidad_id;

      if (!comunidadId) {
        return res.status(400).json({
          message: "Não foi possível resolver a comunidade de origem da interação"
        });
      }

      await respuesta.update({ estado });

      return res.json({
        message: "Estado atualizado",
        data: {
          id: respuesta.id,
          interaccion_id: respuesta.interaccion_id,
          estado: respuesta.estado,
          comunidad_id: comunidadId
        }
      });
    } catch (err) {
      console.error("actualizarEstado respuesta error:", err.message);
      return res.status(500).json({
        message: "Erro ao atualizar o estado da resposta"
      });
    }
  };

  return { crear, actualizarEstado };
};

module.exports = {
  ...createRespuestasController(),
  createRespuestasController
};
