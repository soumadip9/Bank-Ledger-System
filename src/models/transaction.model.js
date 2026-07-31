const mongoose=require('mongoose');

const transactionSchema=new mongoose.Schema({
    fromAccount:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Account',
        required:[true,"From account is required"],
        index:true
    },
    toAccount:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Account',
        required:[true,"To account is required"],
        index:true
    },
    status:{
        type:String,
        enum:{
            values:["pending","completed","failed"],
            message:"Status must be either pending, completed or failed"
        },
        default:"pending"
    },
    amount:{
        type:Number,
        required:[true,"Amount is required"],
        min:[0,"Amount must be greater than 0"]
    },
    idempotencyKey:{
        type:String,
        unique:true,
        required:[true,"Idempotency key is required"],
        index:true
    }
},
    {
        timestamps:true
    })

    const transactionModel=mongoose.model('Transaction',transactionSchema);
    module.exports=transactionModel;