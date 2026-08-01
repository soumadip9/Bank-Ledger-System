const { Sequelize } = require('sequelize');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: process.env.DB_SSL === 'false'
    ? {}
    : {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
});

async function connectToDB() {
  try {
    await sequelize.authenticate();
    const { syncModels } = require('../models');
    await syncModels();
    console.log('Connected to PostgreSQL');
  } catch (err) {
    console.log('Error connecting to PostgreSQL:', err);
    process.exit(1);
  }
}

module.exports = {
  sequelize,
  connectToDB,
};
