
const { Interaccion, Respuesta, User, Comunidad } = require("../models");
const { Op, Sequelize } = require("sequelize");

exports.crear = async (req, res) => {
  try {
    let { urgencia = "normal", tipo, descripcion } = req.body;

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

    const data = await Interaccion.create({
      ...req.body,
      urgencia
    });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
};

exports.listar = async (req, res) => {
  try {
    const comunidad_id = Number(req.params.comunidad_id);

    const data = await Interaccion.findAll({
      where: {
        [Op.or]: [
          { visibilidad: "global" },
          { comunidad_id }
        ]
      },
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

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
};
