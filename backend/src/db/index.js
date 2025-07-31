const { Sequelize } = require('sequelize');
const config = require('../config/config.js');
const env = process.env.NODE_ENV || 'development';

const dbConfig = config[env];

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: false, // puedes cambiar a true si deseas más detalles
  }
);

module.exports = sequelize;
