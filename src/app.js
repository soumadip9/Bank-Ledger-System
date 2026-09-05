const express=require('express');
const cookieParser=require('cookie-parser');
const authRouter=require('./routes/auth.routes');
const accountRouter=require('./routes/account.routes');
const transactionRouter=require('./routes/transaction.routes');
const { setupSwagger }=require('./config/swagger');
const { globalLimiter, authLimiter } = require('./middleware/rateLimiter.middleware');

const app=express();
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
    res.status(200).json({
        status: "ok",
        message: "Bank Ledger System is running"
    });
});

setupSwagger(app);

app.use("/api/auth", authLimiter, authRouter);
app.use("/api/account", globalLimiter, accountRouter);
app.use("/api/transactions", globalLimiter, transactionRouter);

module.exports=app;