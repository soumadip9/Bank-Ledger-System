const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Transaction = sequelize.define(
  'Transaction',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    fromAccountId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'from_account_id',
    },
    toAccountId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'to_account_id',
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    idempotencyKey: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: 'idempotency_key',
    },
  },
  {
    tableName: 'transactions',
    timestamps: true,
    indexes: [
      { fields: ['from_account_id'] },
      { fields: ['to_account_id'] },
      { fields: ['idempotency_key'], unique: true },
    ],
  }
);

Transaction.prototype.toJSON = function toJSON() {
  const values = { ...this.get() };
  values._id = values.id;
  values.fromAccount = values.fromAccountId;
  values.toAccount = values.toAccountId;
  values.amount = Number(values.amount);
  return values;
};

module.exports = Transaction;
