const mongoose = require ("mongoose")
const {Schema}=mongoose;

const userschema=new Schema({
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
        unique:true,
        sparse:true,
        default:null
    },
    googleId:{
        type:String,
        unique:true,
        sparse: true,// Prevents unique constraint errors for null values
    },
    is_blocked:{
        type:Boolean,
        default:false,
    },
    is_admin:{
        type:Boolean,
        default:false,
        required:true
    },
    cart:[{
        type:Schema.Types.ObjectId,
        ref:'Cart',
    }],
    wallet:{
        type:Number,
        default:0,
    },
    wishlist:[{
        type:Schema.Types.ObjectId,
        ref:'Wishlist'
    }],
    orderHistory:[{
        type:Schema.Types.ObjectId,
        ref:'Order'
    }],
    createdOn:{
        type:Date,
        default:Date.now,
    },
    referalCode:{
        type:String,
        // required:true
    },
    redeemed:{
        type:Boolean,
        // default:false
    },
    redeemedUsers:[{
        type:Schema.Types.ObjectId,
        ref:'User',
        // required:true
    }],
    searchedHistory:[{
        category:{
            type:Schema.Types.ObjectId,
            ref:'Category',
        },
        brand:{
            type:String
        },
        searchOn:{
            type:Date,
            default:Date.now
        }
    }],
    is_verified:{
        type:Number,
        default:0
    }
});

module.exports = mongoose.model('User',userschema,'userCollection');