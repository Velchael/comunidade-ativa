// src/models/index.js

require('dotenv').config(); // 👈obligatorio para  Carga las variables de entorno desde .env

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');

const basename = path.basename(__filename);
const db = {}; // 🔄 se llamará `db`, no `models`
console.log('📦 DATABASE_URL:', process.env.DATABASE_URL);

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  define: {
    freezeTableName: true,
  },
});

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

