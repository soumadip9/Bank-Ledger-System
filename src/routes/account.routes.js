const express=require('express');
const authMiddleware=require('../middleware/auth.middleware');
const accountController=require('../controllers/account.controller');
const transactionController=require('../controllers/transaction.controller');

const router=express.Router();
router.post("/", authMiddleware.authMiddleware, accountController.createAccountController);


router.get(
    "/balance/:accountId",
    authMiddleware.authMiddleware,
    transactionController.getTransactionById
);

module.exports=router;