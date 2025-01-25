const mongoose = require("mongoose");
const { Schema } = mongoose;

const orderSchema=new Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:'User',
        required:true
    },
    orderId: {
        type: String,
        unique: true
    },
    orderedItems: [{
        product: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            default: 1,
            required: true
        },
        priceAtPurchase: {
            type: Number,
            default:0,
            required: true
        },
        total:{
            type: Number
        }
    }],
    // discount:[{
    //     productDiscount:{
    //         type:Number,
    //     },
    //     couponDiscount:{
    //         type:Number
    //     },
    //     totalDiscount:{
    //         type:Number
    //     }
    // }],
    status: {
        type: String,
        required: true,
        enum: ['Pending','Order Placed','Processing', 'Shipped',"Out for delivery", 'Delivered', 'Cancelled', 'Return Request', 'Returned','Payment failed'],
        default:"Order Placed"
    },
    statusHistory: [{
        status: {
            type: String,
            required: true,
            enum: ['Pending','Order Placed','Processing', 'Shipped',"Out for delivery", 'Delivered', 'Cancelled', 'Return Request', 'Returned']
        },
        date: {
            type: Date,
            default: Date.now
        },
        note: String
    }],
    totalDiscount: {
        type: Number,
        default: 0
    },
    finalAmount: {
        type: Number,
        default:0,
        required: true
    },

    address:{
        name:{
            type:String,
            // required: true
        },
        mobile:{
            type:String,
            // required: true
        },
        typeOfAddress: {
            type: String,
            enum: ['Work', 'Home'],
            default: 'Home'
        },
        streetAddress: {
            type: String,
            // required: true
        },
        city: {
            type: String,
            // required: true
        },
        state: {
            type: String,
            // required: true
        },
        country: {
            type: String,
            // required: true
        },
        pincode: {
            type: Number,
            // required: true
        }
    },
    paymentMethod:{
        type: String,
        required: true,
        enum:['COD','Online Payment','Wallet'],
        default:"COD"
    },
    paymentStatus: {
        type: String,
        enum: ["Pending", "Success","Paid", "Failed","Cancelled"],
        required: true,
        default: "Pending"
    },
    invoiceDate: {
        type: Date
    },
    couponDiscount: {
        type: Number,
        default: 0
    },
    couponCode: {
        type: String
    },
    coupon: {
        type: Schema.Types.ObjectId,
        ref: 'Coupon'
    },
    // createdOn: {
    //     type: Date,
    //     default: Date.now,
    //     required: true
    // },
    // couponApplied: {
    //     type: Boolean,
    //     default: false
    // },
    // couponApplied: {
    //     code: String,
    //     discountAmount: Number
    // },
    deliveredOn: { type: Date, default: null },
    cancelledOn: { type: Date, default: null },
    returnDetails: {
        returnRequested: {
            type: Boolean,
            default: false
        },
        returnStatus: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected'],
            default: 'Pending'
        },
        returnReason: String,
        returnRequestedAt: Date,
        returnDate: Date
    }
},{timestamps:true})

// Pre-save middleware to generate a unique orderId
orderSchema.pre('save', async function(next) {
    if (!this.orderId) {
        // Generate a unique orderId, e.g., using a timestamp
        this.orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
    next();
});

const Order = mongoose.model("Order", orderSchema);
module.exports=Order;