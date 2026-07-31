const transactionModel = require("../models/transaction.model");
const ledgerModel = require("../models/ledger.model");
const accountModel = require("../models/account.model");
const emailService = require("../services/email.service");
const mongoose = require("mongoose");

async function createTransaction(req, res) {
    const { fromAccount, toAccount, amount, idempotencyKey } = req.body;

    if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
        return res.status(400).json({
            message: "Missing required fields"
        });
    }

    const fromUserAccount = await accountModel
        .findById(fromAccount)
        .populate("user");

    const toUserAccount = await accountModel
        .findById(toAccount)
        .populate("user");

    if (!fromUserAccount || !toUserAccount) {
        return res.status(404).json({
            message: "One or both accounts not found"
        });
    }

    const existingTransaction = await transactionModel.findOne({
        idempotencyKey,
    });

    if (existingTransaction?.status === "failed") {
        return res.status(500).json({
            message: "Transaction failed previously. Please try again later.",
        });
    }

    if (existingTransaction?.status === "completed") {
        return res.status(200).json({
            message: "Transaction already completed",
            transaction: existingTransaction,
        });
    }

    if (existingTransaction?.status === "pending") {
        return res.status(200).json({
            message: "Transaction is still pending",
            transaction: existingTransaction,
        });
    }

    if (
        fromUserAccount.status !== "active" ||
        toUserAccount.status !== "active"
    ) {
        return res.status(400).json({
            message: "One or both accounts are not active",
        });
    }

    const balance = await fromUserAccount.getBalance();

    if (balance < amount) {
        return res.status(400).json({
            message: `Insufficient balance. Current balance: ${balance}`,
        });
    }

    const session = await mongoose.startSession();
    let committed = false;

    try {
        session.startTransaction();

        const transaction = new transactionModel({
            fromAccount,
            toAccount,
            amount,
            idempotencyKey,
            status: "pending",
        });

        await ledgerModel.create([{
            account: fromUserAccount._id,
            amount: amount,
            transaction: transaction._id,
            type: "debit"
        }], { session });

        await ledgerModel.create([{
            account: toUserAccount._id,
            amount: amount,
            transaction: transaction._id,
            type: "credit"
        }], { session });

        transaction.status = "completed";
        await transaction.save({ session });
        await session.commitTransaction();
        committed = true;

        // Respond immediately — do not block on email (Gmail OAuth is slow on Render
        // and used to throw 500 after money already moved).
        res.status(201).json({
            message: "Transaction completed successfully",
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
                    console.error("Transaction email failed:", emailError.message);
                });
        }
    } catch (error) {
        if (!committed) {
            try {
                await session.abortTransaction();
            } catch (abortError) {
                console.error("Abort transaction failed:", abortError.message);
            }
        }

        if (!res.headersSent) {
            return res.status(500).json({
                message: error.message,
            });
        }
    } finally {
        session.endSession();
    }
}

async function createInitialFundTransaction(req, res) {
    const { toAccount, amount, idempotencyKey } = req.body;

    if (!toAccount || !amount || !idempotencyKey) {
        return res.status(400).json({
            message: "Missing required fields"
        });
    }
    const toUserAccount = await accountModel.findOne({
        _id: toAccount
    });

    if (!toUserAccount) {
        return res.status(404).json({
            message: "Account not found"
        });
    }
    const fromUserAccount = await accountModel.findOne({
        user: req.user._id
    });
    if(!fromUserAccount){
        return res.status(404).json({
            message: "System user account not found"
        });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    const transaction = await transactionModel({
    fromAccount: fromUserAccount._id,
    toAccount: toUserAccount._id,
    amount,
    idempotencyKey,
    status: "pending"
    });
    
    const debitLedger = await ledgerModel.create([{
        account: fromUserAccount._id,
        amount: amount,
        transaction: transaction._id,
        type: "debit"
    }], { session })
    const creditLedger = await ledgerModel.create([{
        account: toUserAccount._id,
        amount: amount,
        transaction: transaction._id,
        type: "credit"
    }], { session });

    transaction.status = "completed";
    await transaction.save({ session });
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
        message: "Initial fund transaction completed successfully",
        transaction:transaction
    });
}

async function getTransactionById(req, res) {
    const { accountId } = req.params;

    const account = await accountModel.findOne({
        _id: accountId,
        user: req.user._id
    });

    if (!account) {
        return res.status(403).json({
            message: "You are not authorized to view this account"
        });
    }

    const balance = await account.getBalance();

    return res.status(200).json({
        accountId: account._id,
        balance
    });
}

module.exports = {
    createTransaction,
    createInitialFundTransaction,
    getTransactionById
};