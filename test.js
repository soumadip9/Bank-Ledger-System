require('dotenv').config();
const { sequelize } = require('./src/config/db');

sequelize
  .authenticate()
  .then(() => {
    console.log('Connected to PostgreSQL');
    process.exit(0);
  })
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
