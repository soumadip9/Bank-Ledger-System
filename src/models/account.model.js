const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Account = sequelize.define(
  'Account',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
    },
    status: {
      type: DataTypes.ENUM('active', 'frozen', 'closed'),
      allowNull: false,
      defaultValue: 'active',
    },
    currency: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'INR',
    },
  },
  {
    tableName: 'accounts',
    timestamps: true,
    indexes: [{ fields: ['user_id', 'status'] }],
  }
);

Account.prototype.getBalance = async function getBalance(options = {}) {
  const Ledger = require('./ledger.model');
  const { literal } = require('sequelize');

  const row = await Ledger.findOne({
    attributes: [
      [
        literal(`
          COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0)
        `),
        'balance',
      ],
    ],
    where: { accountId: this.id },
    raw: true,
    transaction: options.transaction,
  });

  const balance = row?.balance;
  return balance === null || balance === undefined ? 0 : Number(balance);
};

Account.prototype.toJSON = function toJSON() {
  const values = { ...this.get() };
  values._id = values.id;
  values.user = values.userId;
  return values;
};

module.exports = Account;
