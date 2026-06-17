const { Respuesta } = require("../models");

const ESTADOS_PERMITIDOS = ["activa", "oculta"];

exports.crear = async (req, res) => {
  try {
    const data = await Respuesta.create(req.body);
    return res.json(data);
  } catch (err) {
    return res.status(500).json(err);
  }
};

exports.actualizarEstado = async (req, res) => {
  try {
    const estado = String(req.body?.estado || "").trim().toLowerCase();

    if (!ESTADOS_PERMITIDOS.includes(estado)) {
      return res.status(400).json({
        message: "estado inválido. Solo se permite activa u oculta"
      });
    }

    const respuesta = req.respuestaTarget;

    if (!respuesta) {
      return res.status(404).json({ message: "Respuesta no encontrada" });
    }

    const comunidadId = respuesta.interaccion?.comunidad_id;

    if (!comunidadId) {
      return res.status(400).json({
        message: "No se pudo resolver la comunidad origen de la interacción"
      });
    }

    await respuesta.update({ estado });

    return res.json({
      message: "Estado actualizado",
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
      message: "Error actualizando estado de la respuesta"
    });
  }
};
