
// backend/src/database/connection.js

const { Pool } = require('pg');
require('dotenv').config();

const {
  DB_DATABASE,
  DB_HOST,
  DB_PASSWORD,
  DB_PORT,
  DB_USER,
} = require("../../config.js");

console.log({
  DB_DATABASE,
  DB_HOST,
  DB_PASSWORD,
  DB_PORT,
  DB_USER,
});

const pool = new Pool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_DATABASE,
  port: Number(DB_PORT),  // Asegura que sea número
  ssl: false,             // Desactiva SSL (opcional en desarrollo)
});

module.exports = pool;
