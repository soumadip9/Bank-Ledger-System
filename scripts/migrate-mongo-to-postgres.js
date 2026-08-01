/**
 * One-time migration: MongoDB (Mongoose collections) -> PostgreSQL (Sequelize).
 *
 * Requires:
 *   MONGO_URI=...
 *   DATABASE_URL=...
 *   DB_SSL=false   (optional, for local Postgres)
 *
 * Optional:
 *   MIGRATE_CLEAR=true   truncate Postgres tables before import
 *
 * Usage:
 *   npm run migrate:mongo
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const {
  sequelize,
  syncModels,
  User,
  Account,
  Transaction,
  Ledger,
  Blacklist,
} = require('../src/models');

function oid(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value.$oid) return value.$oid;
  return String(value);
}

async function getCollection(db, names) {
  const existing = await db.listCollections().toArray();
  const existingNames = new Set(existing.map((c) => c.name));
  for (const name of names) {
    if (existingNames.has(name)) {
      return db.collection(name);
    }
  }
  // fallback to first candidate (may be empty)
  return db.collection(names[0]);
}

async function clearPostgres() {
  console.log('Clearing PostgreSQL tables...');
  await sequelize.query('TRUNCATE TABLE ledgers, transactions, blacklists, accounts, users RESTART IDENTITY CASCADE;');
}

async function migrate() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is required');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  console.log('Connecting to MongoDB...');
  const mongo = new MongoClient(mongoUri);
  await mongo.connect();
  const db = mongo.db();

  console.log('Connecting to PostgreSQL...');
  await sequelize.authenticate();
  await syncModels();

  if (process.env.MIGRATE_CLEAR === 'true') {
    await clearPostgres();
  }

  const userMap = new Map(); // mongoId -> uuid
  const accountMap = new Map();
  const transactionMap = new Map();

  // ---- Users ----
  const usersCol = await getCollection(db, ['users', 'user']);
  const mongoUsers = await usersCol.find({}).toArray();
  console.log(`Users found in Mongo: ${mongoUsers.length}`);

  const userRows = [];
  for (const doc of mongoUsers) {
    const mongoId = oid(doc._id);
    const id = uuidv4();
    userMap.set(mongoId, id);
    userRows.push({
      id,
      email: doc.email,
      name: doc.name,
      password: doc.password, // already bcrypt-hashed; insert with hooks disabled
      systemUser: Boolean(doc.systemUser),
      createdAt: doc.createdAt || new Date(),
      updatedAt: doc.updatedAt || new Date(),
    });
  }

  if (userRows.length) {
    await User.bulkCreate(userRows, { hooks: false, validate: false });
  }
  console.log(`Users inserted: ${userRows.length}`);

  // ---- Accounts ----
  const accountsCol = await getCollection(db, ['accounts', 'account']);
  const mongoAccounts = await accountsCol.find({}).toArray();
  console.log(`Accounts found in Mongo: ${mongoAccounts.length}`);

  const accountRows = [];
  let skippedAccounts = 0;
  for (const doc of mongoAccounts) {
    const mongoId = oid(doc._id);
    const ownerMongoId = oid(doc.user);
    const userId = userMap.get(ownerMongoId);
    if (!userId) {
      skippedAccounts += 1;
      console.warn(`Skip account ${mongoId}: missing user ${ownerMongoId}`);
      continue;
    }
    const id = uuidv4();
    accountMap.set(mongoId, id);
    accountRows.push({
      id,
      userId,
      status: doc.status || 'active',
      currency: doc.currency || 'INR',
      createdAt: doc.createdAt || new Date(),
      updatedAt: doc.updatedAt || new Date(),
    });
  }

  if (accountRows.length) {
    await Account.bulkCreate(accountRows, { hooks: false, validate: false });
  }
  console.log(`Accounts inserted: ${accountRows.length} (skipped: ${skippedAccounts})`);

  // ---- Transactions ----
  const txCol = await getCollection(db, ['transactions', 'transaction']);
  const mongoTx = await txCol.find({}).toArray();
  console.log(`Transactions found in Mongo: ${mongoTx.length}`);

  const txRows = [];
  let skippedTx = 0;
  for (const doc of mongoTx) {
    const mongoId = oid(doc._id);
    const fromAccountId = accountMap.get(oid(doc.fromAccount));
    const toAccountId = accountMap.get(oid(doc.toAccount));
    if (!fromAccountId || !toAccountId) {
      skippedTx += 1;
      console.warn(`Skip transaction ${mongoId}: missing account mapping`);
      continue;
    }
    const id = uuidv4();
    transactionMap.set(mongoId, id);
    txRows.push({
      id,
      fromAccountId,
      toAccountId,
      status: doc.status || 'completed',
      amount: doc.amount,
      idempotencyKey: doc.idempotencyKey,
      createdAt: doc.createdAt || new Date(),
      updatedAt: doc.updatedAt || new Date(),
    });
  }

  if (txRows.length) {
    await Transaction.bulkCreate(txRows, { hooks: false, validate: false });
  }
  console.log(`Transactions inserted: ${txRows.length} (skipped: ${skippedTx})`);

  // ---- Ledgers ----
  const ledgerCol = await getCollection(db, ['ledgers', 'ledger']);
  const mongoLedgers = await ledgerCol.find({}).toArray();
  console.log(`Ledgers found in Mongo: ${mongoLedgers.length}`);

  const ledgerRows = [];
  let skippedLedgers = 0;
  for (const doc of mongoLedgers) {
    const accountId = accountMap.get(oid(doc.account));
    const transactionId = transactionMap.get(oid(doc.transaction));
    if (!accountId || !transactionId) {
      skippedLedgers += 1;
      console.warn(`Skip ledger ${oid(doc._id)}: missing account/transaction mapping`);
      continue;
    }
    ledgerRows.push({
      id: uuidv4(),
      accountId,
      amount: doc.amount,
      transactionId,
      type: doc.type,
      createdAt: doc.createdAt || new Date(),
    });
  }

  if (ledgerRows.length) {
    await Ledger.bulkCreate(ledgerRows, { hooks: false, validate: false });
  }
  console.log(`Ledgers inserted: ${ledgerRows.length} (skipped: ${skippedLedgers})`);

  // ---- Blacklist ----
  const blacklistCol = await getCollection(db, ['blacklists', 'blacklist']);
  const mongoBlacklist = await blacklistCol.find({}).toArray();
  console.log(`Blacklist rows found in Mongo: ${mongoBlacklist.length}`);

  const blacklistRows = mongoBlacklist.map((doc) => ({
    id: uuidv4(),
    token: doc.token,
    expiresAt: doc.expiresAt,
    createdAt: doc.createdAt || new Date(),
    updatedAt: doc.updatedAt || new Date(),
  }));

  if (blacklistRows.length) {
    await Blacklist.bulkCreate(blacklistRows, {
      hooks: false,
      validate: false,
      ignoreDuplicates: true,
    });
  }
  console.log(`Blacklist rows inserted: ${blacklistRows.length}`);

  console.log('\nMigration complete.');
  console.log('ID maps: Mongo ObjectId -> new Postgres UUID (not persisted).');
  console.log('Users must log in again with the same email/password (hashes were copied).');

  await mongo.close();
  await sequelize.close();
}

migrate().catch(async (err) => {
  console.error('Migration failed:', err);
  try {
    await sequelize.close();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
