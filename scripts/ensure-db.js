require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  // Connect to maintenance DB to ensure target DB exists (local use).
  const url = new URL(databaseUrl);
  const targetDb = url.pathname.replace(/^\//, '') || 'bank_ledger';
  url.pathname = '/postgres';

  const client = new Client({
    connectionString: url.toString(),
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  await client.connect();
  console.log('Connected to PostgreSQL');

  const result = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [targetDb]
  );

  if (result.rowCount === 0) {
    await client.query(`CREATE DATABASE "${targetDb}"`);
    console.log(`Created database ${targetDb}`);
  } else {
    console.log(`Database ${targetDb} already exists`);
  }

  await client.end();
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
