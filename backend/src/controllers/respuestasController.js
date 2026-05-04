const { Respuesta } = require("../models");

exports.crear = async (req, res) => {
  try {
    const data = await Respuesta.create(req.body);
    res.json(data);
  } catch (err) {
    res.status(500).json(err);
  }
};