require('dotenv').config();

module.exports = {
  development: {
    username: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '123456',
    database: process.env.PG_DATABASE || 'comunidad',
    host: process.env.PG_HOST || 'db',
    port: process.env.PG_PORT || 5432,
    dialect: 'postgres',
  }
};
