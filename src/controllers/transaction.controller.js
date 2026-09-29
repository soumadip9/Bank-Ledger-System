const {
  sequelize,
  Transaction,
  Ledger,
  Account,
  User,
} = require('../models');
const emailService = require('../services/email.service');

async function createTransaction(req, res) {
  const { fromAccount, toAccount, amount, idempotencyKey } = req.body;

  if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
    return res.status(400).json({
      message: 'Missing required fields',
    });
  }

  const existingTransaction = await Transaction.findOne({
    where: { idempotencyKey },
  });

  if (existingTransaction?.status === 'failed') {
    return res.status(500).json({
      message: 'Transaction failed previously. Please try again later.',
    });
  }

  if (existingTransaction?.status === 'completed') {
    return res.status(200).json({
      message: 'Transaction already completed',
      transaction: existingTransaction,
    });
  }

  if (existingTransaction?.status === 'pending') {
    return res.status(200).json({
      message: 'Transaction is still pending',
      transaction: existingTransaction,
    });
  }

  const t = await sequelize.transaction();
  let committed = false;

  try {
    if (fromAccount === toAccount) {
      await t.rollback();
      committed = true;
      return res.status(400).json({
        message: 'Cannot transfer money to the same account',
      });
    }

    // Deterministic Lock Ordering: Sort account IDs to prevent deadlocks under concurrent transfers
    const sortedAccountIds = [fromAccount, toAccount].sort();
    const accountsMap = {};

    for (const id of sortedAccountIds) {
      const acc = await Account.findByPk(id, {
        include: [{ model: User, as: 'user' }],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (acc) {
        accountsMap[acc.id] = acc;
      }
    }

    const fromUserAccount = accountsMap[fromAccount];
    const toUserAccount = accountsMap[toAccount];

    if (!fromUserAccount || !toUserAccount) {
      await t.rollback();
      committed = true;
      return res.status(404).json({
        message: 'One or both accounts not found',
      });
    }

    if (
      fromUserAccount.status !== 'active' ||
      toUserAccount.status !== 'active'
    ) {
      await t.rollback();
      committed = true;
      return res.status(400).json({
        message: 'One or both accounts are not active',
      });
    }

    const balance = await fromUserAccount.getBalance({ transaction: t });

    if (balance < amount) {
      await t.rollback();
      committed = true;
      return res.status(400).json({
        message: `Insufficient balance. Current balance: ${balance}`,
      });
    }

    const transaction = await Transaction.create(
      {
        fromAccountId: fromAccount,
        toAccountId: toAccount,
        amount,
        idempotencyKey,
        status: 'pending',
      },
      { transaction: t }
    );

    await Ledger.create(
      {
        accountId: fromUserAccount.id,
        amount: amount,
        transactionId: transaction.id,
        type: 'debit',
      },
      { transaction: t }
    );

    await Ledger.create(
      {
        accountId: toUserAccount.id,
        amount: amount,
        transactionId: transaction.id,
        type: 'credit',
      },
      { transaction: t }
    );

    transaction.status = 'completed';
    await transaction.save({ transaction: t });
    await t.commit();
    committed = true;

    res.status(201).json({
      message: 'Transaction completed successfully',
      transaction,
    });

    if (fromUserAccount.user?.email) {
      emailService
        .sendTransactionEmail(
          fromUserAccount.user.email,
          fromUserAccount.user.name,
          toUserAccount.user.name,
          amount
        )
        .catch((emailError) => {
          console.error('Transaction email failed:', emailError.message);
        });
    }
  } catch (error) {
    if (!committed) {
      try {
        await t.rollback();
      } catch (rollbackError) {
        console.error('Abort transaction failed:', rollbackError.message);
      }
    }

    if (!res.headersSent) {
      return res.status(500).json({
        message: error.message,
      });
    }
  }
}

async function createInitialFundTransaction(req, res) {
  const { toAccount, amount, idempotencyKey } = req.body;

  if (!toAccount || !amount || !idempotencyKey) {
    return res.status(400).json({
      message: 'Missing required fields',
    });
  }
  const toUserAccount = await Account.findOne({
    where: { id: toAccount },
  });

  if (!toUserAccount) {
    return res.status(404).json({
      message: 'Account not found',
    });
  }
  const fromUserAccount = await Account.findOne({
    where: { userId: req.user.id },
  });
  if (!fromUserAccount) {
    return res.status(404).json({
      message: 'System user account not found',
    });
  }

  const t = await sequelize.transaction();
  let committed = false;

  try {
    // Deterministic Lock Ordering: Sort account IDs to prevent deadlocks
    const sortedAccountIds = [fromUserAccount.id, toUserAccount.id].sort();
    const accountsMap = {};

    for (const id of sortedAccountIds) {
      const acc = await Account.findByPk(id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (acc) {
        accountsMap[acc.id] = acc;
      }
    }

    const lockedFromAccount = accountsMap[fromUserAccount.id];
    const lockedToAccount = accountsMap[toUserAccount.id];

    if (!lockedFromAccount || !lockedToAccount) {
      await t.rollback();
      committed = true;
      return res.status(404).json({
        message: 'System or target account not found',
      });
    }

    const transaction = await Transaction.create(
      {
        fromAccountId: lockedFromAccount.id,
        toAccountId: lockedToAccount.id,
        amount,
        idempotencyKey,
        status: 'pending',
      },
      { transaction: t }
    );

    await Ledger.create(
      {
        accountId: lockedFromAccount.id,
        amount: amount,
        transactionId: transaction.id,
        type: 'debit',
      },
      { transaction: t }
    );
    await Ledger.create(
      {
        accountId: lockedToAccount.id,
        amount: amount,
        transactionId: transaction.id,
        type: 'credit',
      },
      { transaction: t }
    );

    transaction.status = 'completed';
    await transaction.save({ transaction: t });
    await t.commit();
    committed = true;

    return res.status(201).json({
      message: 'Initial fund transaction completed successfully',
      transaction: transaction,
    });
  } catch (error) {
    if (!committed) {
      try {
        await t.rollback();
      } catch (rollbackError) {
        console.error('Abort initial fund transaction failed:', rollbackError.message);
      }
    }

    if (!res.headersSent) {
      return res.status(500).json({
        message: error.message,
      });
    }
  }
}

async function getTransactionById(req, res) {
  const { accountId } = req.params;

  const account = await Account.findOne({
    where: {
      id: accountId,
      userId: req.user.id,
    },
  });

  if (!account) {
    return res.status(403).json({
      message: 'You are not authorized to view this account',
    });
  }

  const balance = await account.getBalance();

  return res.status(200).json({
    accountId: account.id,
    balance,
  });
}

module.exports = {
  createTransaction,
  createInitialFundTransaction,
  getTransactionById,
};
