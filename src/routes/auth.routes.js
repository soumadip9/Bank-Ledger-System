const router=require('express').Router();
const authController=require('../controllers/auth.controller');



router.post("/register",authController.userRegisterController);

router.post("/login",authController.userLoginController);



module.exports=router;