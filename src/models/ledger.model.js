const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Ledger = sequelize.define(
  'Ledger',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    accountId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'account_id',
    },
    amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    transactionId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'transaction_id',
    },
    type: {
      type: DataTypes.ENUM('credit', 'debit'),
      allowNull: false,
    },
  },
  {
    tableName: 'ledgers',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['account_id'] },
      { fields: ['transaction_id'] },
    ],
    hooks: {
      beforeUpdate: () => {
        throw new Error('Ledger entries cannot be modified or deleted');
      },
      beforeDestroy: () => {
        throw new Error('Ledger entries cannot be modified or deleted');
      },
      beforeBulkUpdate: () => {
        throw new Error('Ledger entries cannot be modified or deleted');
      },
      beforeBulkDestroy: () => {
        throw new Error('Ledger entries cannot be modified or deleted');
      },
    },
  }
);

Ledger.prototype.toJSON = function toJSON() {
  const values = { ...this.get() };
  values._id = values.id;
  values.account = values.accountId;
  values.transaction = values.transactionId;
  values.amount = Number(values.amount);
  return values;
};

module.exports = Ledger;
