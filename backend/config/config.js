require('dotenv').config(); // para leer variables desde .env

module.exports = {
  development: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'comunidad',
    host: process.env.DB_HOST || 'db',
    port: process.env.PG_PORT || 5432,
    dialect: 'postgres'
  }
};
