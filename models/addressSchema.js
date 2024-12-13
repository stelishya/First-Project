const mongoose=require('mongoose');
const {Schema}=mongoose;

const addressSchema = new Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:'User',
        required:true
    },
    address:[{
        typeOfAddress:{
            type:String,
            // isDefault:true,
            required:true
        },
        name:{
            type:String,
            required:true
        },
        streetAddress:{
            type:String,
            required:true
        },
        city:{
            type:String,
            required:true
        },
        // landMark:{
        //     type:String,
        //     required:true
        // },
        state:{
            type:String,
            required:true
        },
        pincode:{
            type:String,
            required:true
        },
        mobile:{
            type:String,
            required:true
        },
        country:{
            type:String,
            required:true
        }
    }]
})

module.exports = mongoose.model('Address',addressSchema);