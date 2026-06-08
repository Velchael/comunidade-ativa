const { Interaccion, Respuesta, User, Comunidad } = require("../models");
const { Op, Sequelize } = require("sequelize");
const ESTADOS_PERMITIDOS = ["abierto", "cerrado", "en_proceso", "oculto"];

exports.crear = async (req, res) => {
  try {
    let { urgencia = "normal", tipo, descripcion, categoria, visibilidad, imagen_url } = req.body;

    if (tipo !== "necesidad") {
      urgencia = "normal";
    }

    const texto = (descripcion || "").toLowerCase();

    if (
      texto.includes("hambre") ||
      texto.includes("comida") ||
      texto.includes("emergencia")
    ) {
      urgencia = "critica";
    }

    const comunidad_id = Number(req.comunidadAuth?.comunidad_id);

    const data = await Interaccion.create({
      user_id: req.user.id,
      comunidad_id,
      tipo,
      descripcion,
      categoria,
      visibilidad,
      imagen_url,
      estado: "abierto",
      urgencia
    });

    return res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
};

exports.listar = async (req, res) => {
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
      include: [
        {
          model: User,
          as: "usuario",
          attributes: ["id", "username"]
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
              attributes: ["id", "username"]
            }
          ]
        }
      ],
      order: [
        [
          Sequelize.literal(`
            CASE 
              WHEN urgencia = 'critica' THEN 1
              WHEN urgencia = 'alta' THEN 2
              WHEN urgencia = 'normal' THEN 3
              ELSE 4
            END
          `),
          "ASC"
        ],
        ["created_at", "DESC"]
      ]
    });

    return res.json({
      items: data,
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
    console.error(err);
    res.status(500).json(err);
  }
};

exports.actualizarEstado = async (req, res) => {
  try {
    const estado = String(req.body?.estado || "").trim().toLowerCase();

    if (!ESTADOS_PERMITIDOS.includes(estado)) {
      return res.status(400).json({
        message: "estado inválido. Solo se permite abierto, cerrado, en_proceso u oculto"
      });
    }

    const interaccion = req.interaccionTarget;

    if (!interaccion) {
      return res.status(404).json({ message: "Interacción no encontrada" });
    }

    await interaccion.update({ estado });

    return res.json({
      message: "Estado actualizado",
      data: {
        id: interaccion.id,
        comunidad_id: interaccion.comunidad_id,
        estado: interaccion.estado
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json(err);
  }
};
