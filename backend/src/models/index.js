// src/models/index.js
// Carga automática de modelos usando la instancia única de Sequelize

const fs = require('fs');
const path = require('path');
const sequelize = require('../db'); // ← Importar instancia única
const { Sequelize } = require('sequelize');

const basename = path.basename(__filename);
const db = {};

// Cargar todos los modelos automáticamente
fs.readdirSync(__dirname)
  .filter((file) =>
    file !== basename &&
    file.endsWith('.js')
  )
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

// Ejecutar asociaciones si existen
Object.keys(db).forEach((modelName) => {
  if (typeof db[modelName].associate === 'function') {
    db[modelName].associate(db);
  }
});

// Exponer sequelize y modelos
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
