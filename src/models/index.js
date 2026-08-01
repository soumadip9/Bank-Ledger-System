const { sequelize } = require('../config/db');
const User = require('./user.model');
const Account = require('./account.model');
const Transaction = require('./transaction.model');
const Ledger = require('./ledger.model');
const Blacklist = require('./blacklist.model');

User.hasMany(Account, { foreignKey: 'userId', as: 'accounts' });
Account.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Account.hasMany(Transaction, { foreignKey: 'fromAccountId', as: 'outgoingTransactions' });
Account.hasMany(Transaction, { foreignKey: 'toAccountId', as: 'incomingTransactions' });
Transaction.belongsTo(Account, { foreignKey: 'fromAccountId', as: 'fromAccount' });
Transaction.belongsTo(Account, { foreignKey: 'toAccountId', as: 'toAccount' });

Transaction.hasMany(Ledger, { foreignKey: 'transactionId', as: 'ledgerEntries' });
Ledger.belongsTo(Transaction, { foreignKey: 'transactionId', as: 'transaction' });
Account.hasMany(Ledger, { foreignKey: 'accountId', as: 'ledgerEntries' });
Ledger.belongsTo(Account, { foreignKey: 'accountId', as: 'account' });

async function syncModels() {
  await sequelize.sync({ alter: true });
}

module.exports = {
  sequelize,
  syncModels,
  User,
  Account,
  Transaction,
  Ledger,
  Blacklist,
};
