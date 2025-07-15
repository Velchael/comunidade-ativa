const { config } = require("dotenv");
config();

module.exports = {
  PORT: process.env.PORT,
  JWT_SECRET: process.env.JWT_SECRET,
  DB_HOST: process.env.PG_HOST,
  DB_USER: process.env.PG_USER,
  DB_PASSWORD: process.env.PG_PASSWORD,
  DB_DATABASE: process.env.PG_DATABASE,
  DB_PORT: process.env.PG_PORT
};
