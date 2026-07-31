const mongoose=require('mongoose');

const ledgerSchema=new mongoose.Schema({
    account:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Account',
        required:[true,"Account is required"],
        index:true,
        immutable:true
    },
    amount:{
        type:Number,
        required:[true,"Amount is required"],
        min:[0,"Amount must be greater than 0"],
        immutable:true
    },
    transaction:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Transaction',
        required:[true,"Transaction is required"],
        index:true,
        immutable:true
    },
    type:{
        type:String,
        enum:{
            values:["credit","debit"],
            message:"Type must be either credit or debit",
        },
        required:[true,"Type is required"],
        immutable:true
    }
})


function preventledgerModification(next){
    throw new Error("Ledger entries cannot be modified or deleted");
}

ledgerSchema.pre('updateOne', preventledgerModification);
ledgerSchema.pre('deleteOne', preventledgerModification);
ledgerSchema.pre('findOneAndUpdate', preventledgerModification);
ledgerSchema.pre('findOneAndDelete', preventledgerModification);
ledgerSchema.pre('findOneAndRemove', preventledgerModification);
ledgerSchema.pre('remove', preventledgerModification);
ledgerSchema.pre('deleteMany', preventledgerModification);
ledgerSchema.pre('updateMany', preventledgerModification);
ledgerSchema.pre('findOneAndReplace', preventledgerModification);

const ledgerModel=mongoose.model('Ledger',ledgerSchema);

module.exports=ledgerModel;