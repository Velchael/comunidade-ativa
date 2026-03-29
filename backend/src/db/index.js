const { Sequelize } = require("sequelize");

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("❌ ERROR: DATABASE_URL no está definido");
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === "production";

const sequelize = new Sequelize(dbUrl, {
  dialect: "postgres",
  logging: false,

  dialectOptions: isProduction
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      }
    : {},

  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },

  retry: {
    max: 3,
  },
});

module.exports = sequelize;
