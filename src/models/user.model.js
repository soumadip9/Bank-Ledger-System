const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true,"Email is required"],
        trim: true,
          match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      "Please enter a valid email address"
    ],
    unique: [true,"Email already exists"]
    },
    name: {
        type: String,
        required: [true,"Name is required"],
        trim: true
    },
    password: {
        type: String,
        required: [true,"Password is required"],
        minlength: [6,"Password must be at least 6 characters long"],
        select: false // Exclude password from query results by default
    },
    systemUser: {
        type: Boolean,
        default: false,
        immutable: true,
    }
},{
    timestamps: true
}
);

userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return ;


const hash= await bcrypt.hash(this.password, 10);
this.password = hash;
return
})

userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const userModel = mongoose.model('User', userSchema);

module.exports = userModel;