const accountModel=require('../models/account.model');

async function createAccountController(req,res){
    const {name,description} = req.body;
    const userId = req.user.id;

    try {
        const account = await accountModel.create({
            name,
            description,
            user: req.user._id
        });
        res.status(201).json(account);
    } catch (error) {
        res.status(400).json({message:error.message});
    }
}

async function getUserAccountsController(req,res){
    const userId = req.user.id;
    try {
        const accounts = await accountModel.find({user:userId});        
        res.status(200).json(accounts);
    }
    catch (error) {
        res.status(400).json({message:error.message});
    }
}


module.exports={createAccountController,getUserAccountsController};