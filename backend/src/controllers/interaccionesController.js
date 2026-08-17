const db = require("../models");
const { Op } = require("sequelize");
const { resolveInteractionPhotos } = require("../utils/resolveInteractionPhotos");
const { resolveInteractionMedia } = require("../utils/resolveInteractionMedia");
const s3Service = require("../services/s3Service");

const ESTADOS_PERMITIDOS = ["abierto", "cerrado", "en_proceso", "oculto"];

const resolveComunidadId = (req) => {
  const candidates = [
    req.comunidadAuth?.comunidad_id,
    req.params?.comunidad_id,
    req.body?.comunidad_id,
    req.user?.comunidad_id
  ];

  for (const candidate of candidates) {
    const comunidadId = Number(candidate);
    if (Number.isInteger(comunidadId) && comunidadId > 0) {
      return comunidadId;
    }
  }

  return null;
};

const createInteraccionesController = ({
  Interaccion = db.Interaccion,
  Respuesta = db.Respuesta,
  User = db.User,
  Comunidad = db.Comunidad,
  resolvePhotos = resolveInteractionPhotos,
  resolveMedia = resolveInteractionMedia,
  mediaService = s3Service,
  logger = console
} = {}) => {
  const interactionInclude = [
    {
      model: User,
      as: "usuario",
      attributes: ["id", "username", "foto_perfil"]
    },
    {
      model: Comunidad,
      as: "comunidad",
      attributes: ["id", "nombre_comunidad"]
    },
    {
      model: Respuesta,
      as: "respuestas",
      include: [
        {
          model: User,
          as: "usuario",
          attributes: ["id", "username", "foto_perfil"]
        }
      ]
    }
  ];

  const serializeInteraction = async (item) => {
    const plain = typeof item?.toJSON === "function" ? item.toJSON() : item;
    const withPhotos = await resolvePhotos({
      ...plain,
      respuestas: Array.isArray(plain?.respuestas) ? plain.respuestas : []
    });

    return resolveMedia(withPhotos);
  };

  const findInteractionForResponse = async (id) => {
    const item = await Interaccion.findByPk(id, {
      include: interactionInclude
    });

    return item ? serializeInteraction(item) : null;
  };

  const cleanupCreatedInteraction = async (interaction, reason) => {
    if (!interaction?.destroy) return;

    try {
      await interaction.destroy();
    } catch (error) {
      logger.error?.("Failed to cleanup interaction after image upload error", {
        interactionId: interaction.id,
        reason,
        error: error.message
      });
    }
  };

  const cleanupUploadedImage = async ({ key, interactionId, reason }) => {
    if (!key) return;

    try {
      await mediaService.deleteInteractionImage({ key, interactionId });
    } catch (error) {
      logger.error?.("Failed to cleanup uploaded interaction image", {
        interactionId,
        reason,
        code: error.code,
        error: error.message
      });
    }
  };

  const crear = async (req, res) => {
    let createdInteraction = null;
    let uploadedKey = null;

    try {
      const { tipo, descripcion, categoria, visibilidad } = req.body;
      const urgencia = "normal";

      const comunidad_id = resolveComunidadId(req);

      if (!comunidad_id) {
        return res.status(400).json({
          message: "comunidad_id válido é obrigatório para criar interação"
        });
      }

      createdInteraction = await Interaccion.create({
        user_id: req.user.id,
        comunidad_id,
        tipo,
        descripcion,
        categoria,
        visibilidad,
        imagen_key: null,
        estado: "abierto",
        urgencia
      });

      if (!req.interactionImage) {
        const response = await findInteractionForResponse(createdInteraction.id);
        return res.json(response || await serializeInteraction(createdInteraction));
      }

      try {
        const uploadResult = await mediaService.uploadInteractionImage({
          interactionId: createdInteraction.id,
          buffer: req.interactionImage.buffer,
          contentType: req.interactionImage.contentType,
          extension: req.interactionImage.extension
        });
        uploadedKey = uploadResult.key;
      } catch (error) {
        await cleanupCreatedInteraction(createdInteraction, "s3_upload_failed");
        logger.error?.("Interaction image upload failed", {
          interactionId: createdInteraction.id,
          code: error.code,
          error: error.message
        });
        return res.status(502).json({ message: "Erro ao enviar imagem da interação" });
      }

      try {
        await createdInteraction.update({ imagen_key: uploadedKey });
      } catch (error) {
        await cleanupUploadedImage({
          key: uploadedKey,
          interactionId: createdInteraction.id,
          reason: "imagen_key_update_failed"
        });
        await cleanupCreatedInteraction(createdInteraction, "imagen_key_update_failed");
        logger.error?.("Failed to persist interaction image key", {
          interactionId: createdInteraction.id,
          error: error.message
        });
        return res.status(500).json({ message: "Erro ao salvar imagem da interação" });
      }

      const response = await findInteractionForResponse(createdInteraction.id);
      return res.json(response || await serializeInteraction(createdInteraction));
    } catch (err) {
      logger.error?.(err);
      return res.status(500).json(err);
    }
  };

  const listar = async (req, res) => {
    try {
      const comunidad_id = Number(req.comunidadAuth?.comunidad_id || req.params.comunidad_id);
      const rol = req.comunidadAuth?.rol_comunidad || null;
      const isAdminTotalGlobal =
        req.user?.rol === "admin_total" ||
        req.user?.rol_global === "admin_total";
      const puedeModerar =
        isAdminTotalGlobal ||
        ["admin_total", "admin_basic", "moderador"].includes(rol);
      const where = {
        [Op.or]: [
          { visibilidad: "global" },
          { comunidad_id }
        ]
      };

      if (!puedeModerar) {
        where.estado = {
          [Op.ne]: "oculto"
        };
      }

      const data = await Interaccion.findAll({
        where,
        include: interactionInclude,
        order: [["created_at", "DESC"]]
      });

      const items = await Promise.all(data.map(async (item) => {
        const plain = item.toJSON();
        const puedeVerRespuestasOcultas =
          isAdminTotalGlobal ||
          (
            ["admin_total", "admin_basic", "moderador"].includes(rol) &&
            Number(plain.comunidad_id) === Number(comunidad_id)
          );

        if (!Array.isArray(plain.respuestas)) {
          plain.respuestas = [];
          return resolveMedia(await resolvePhotos(plain));
        }

        plain.respuestas = puedeVerRespuestasOcultas
          ? plain.respuestas
          : plain.respuestas.filter(
              (respuesta) => respuesta.estado !== "oculta"
            );

        return resolveMedia(await resolvePhotos(plain));
      }));

      return res.json({
        items,
        auth: {
          comunidad_id,
          rol_comunidad: rol,
          can_moderate_interacciones: puedeModerar,
          is_admin_total_global: isAdminTotalGlobal,
          source:
            req.comunidadAuth?.source ||
            (isAdminTotalGlobal ? "global_admin" : null)
        }
      });

    } catch (err) {
      logger.error?.(err);
      return res.status(500).json(err);
    }
  };

  const actualizarEstado = async (req, res) => {
    try {
      const estado = String(req.body?.estado || "").trim().toLowerCase();

      if (!ESTADOS_PERMITIDOS.includes(estado)) {
        return res.status(400).json({
          message: "estado inválido. Só são permitidos abierto, cerrado, en_proceso ou oculto"
        });
      }

      const interaccion = req.interaccionTarget;

      if (!interaccion) {
        return res.status(404).json({ message: "Interação não encontrada" });
      }

      await interaccion.update({ estado });

      return res.json({
        message: "Estado atualizado",
        data: {
          id: interaccion.id,
          comunidad_id: interaccion.comunidad_id,
          estado: interaccion.estado
        }
      });
    } catch (err) {
      logger.error?.(err);
      return res.status(500).json(err);
    }
  };

  return {
    actualizarEstado,
    crear,
    listar
  };
};

const controller = createInteraccionesController();

module.exports = {
  ...controller,
  createInteraccionesController,
  resolveComunidadId
};
