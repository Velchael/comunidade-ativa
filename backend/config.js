const { config } = require("dotenv");
config();

const PORT = process.env.PORT;
const JWT_SECRET = process.env.JWT_SECRET;

const DB_HOST = process.env.PG_HOST;
const DB_USER = process.env.PG_USER;
const DB_PASSWORD = process.env.PG_PASSWORD;
const DB_DATABASE = process.env.PG_DATABASE;
const DB_PORT = process.env.PG_PORT;

const KINGHOST_SMTP_HOST = process.env.KINGHOST_SMTP_HOST;
const KINGHOST_SMTP_PORT = process.env.KINGHOST_SMTP_PORT;
const KINGHOST_SMTP_USER = process.env.KINGHOST_SMTP_USER;
const KINGHOST_SMTP_PASSWORD= process.env.KINGHOST_SMTP_PASSWORD;


module.exports = {
    PORT,
    JWT_SECRET,
    DB_HOST,
    DB_USER,
    DB_PASSWORD,
    DB_DATABASE,
    DB_PORT,
    KINGHOST_SMTP_HOST,
    KINGHOST_SMTP_PORT,
    KINGHOST_SMTP_USER,
    KINGHOST_SMTP_PASSWORD
  };