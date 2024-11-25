const mongoose = require ("mongoose")

const userschema=new mongoose.Schema({
    username:{
        type:String,
        required: [true, 'Username is required'],
        unique:true,
        sparse:true,
    },
    email:{
        type:String,
        required:[true, 'Email is required'],
        unique:true,
    },
    password:{
        type:String,
        required:[true, 'Password is required'],
    },
    mobile:{
        type:String,
        required:[true, 'Mobile number is required'],
    },
    is_admin:{
        type:Number,
        required:true
    },
    is_verified:{
        type:Number,
        default:0
    }
});

module.exports = mongoose.model('User',userschema,'userCollection');