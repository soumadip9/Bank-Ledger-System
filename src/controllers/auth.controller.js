const userModel=require('../models/user.model');
const blacklistModel=require('../models/blacklist.model');
const jwt=require('jsonwebtoken');
const emailService=require('../services/email.service');


async function userRegisterController(req,res){
    const { name, email, password } = req.body;

    const isExists = await userModel.findOne({ 
        email:email 
})

if(isExists){
    return res.status(422).json({
        message:"Email already exists",
        status:"failed"
})
}

const user = await userModel.create({
    email,password,name
})

const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "3d"})
res.cookie("token",token)
res.status(201).json({
    user:{
        _id:user._id,
        email:user.email,
        name:user.name
    }
})

await emailService.sendRegistrationEmail(user.email, user.name)

}

async function userLoginController(req,res){
    const { email, password } = req.body;
    const user = await userModel.findOne({ email }).select("+password")
    if(!user){
        return res.status(404).json({
            message:"User not found"
    })
}
const isvalidPassword = await user.comparePassword(password)
if (!isvalidPassword)
return res.status(401).json({
    message:"Invalid password or email"
})
const token=jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "3d"})
res.cookie("token",token)
res.status(200).json({
    user: {
        _id: user._id,
        email: user.email,
        name: user.name
    },
    token: token
});
}

async function userLogoutController(req,res){
    const token=req.cookies.token || req.headers.authorization?.split(" ")[1];
    if(!token){
        return res.status(401).json({
            message:"Unauthorized"
        })
    }

    try {
        const decoded=jwt.verify(token,process.env.JWT_SECRET);

        const alreadyBlacklisted=await blacklistModel.findOne({ token })
        if(!alreadyBlacklisted){
            await blacklistModel.create({
                token,
                expiresAt: new Date(decoded.exp * 1000)
            })
        }

        res.clearCookie("token")
        return res.status(200).json({
            message:"Logged out successfully"
        })
    } catch (error) {
        return res.status(401).json({
            message:"Unauthorized"
        })
    }
}

module.exports={userRegisterController, userLoginController, userLogoutController}