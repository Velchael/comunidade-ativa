//const { Interaccion, Respuesta } = require("../models");
const { Interaccion, Respuesta, User, Comunidad } = require("../models");
const { Op } = require("sequelize");

exports.crear = async (req, res) => {
  try {
    const data = await Interaccion.create(req.body);
    res.json(data);
  } catch (err) {
   // res.status(500).json(err);
  console.error("🔥 ERROR AL CREAR INTERACCION:");
  console.error(err);
  console.error("BODY:", req.body);

  res.status(500).json({
    message: err.message,
    error: err
  });
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
      order: [["created_at", "DESC"]]
    });

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
};

