const { Account } = require('../models');

async function createAccountController(req, res) {
  const { name, description } = req.body;
  const userId = req.user.id;

  try {
    // name/description accepted like before; Account schema persists userId/status/currency
    const account = await Account.create({
      userId: req.user.id,
    });
    res.status(201).json(account);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function getUserAccountsController(req, res) {
  const userId = req.user.id;
  try {
    const accounts = await Account.findAll({ where: { userId: userId } });
    res.status(200).json(accounts);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

module.exports = { createAccountController, getUserAccountsController };
