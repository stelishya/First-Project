const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    name: {
        type: String,
        required: true
    },
    // discountType: {
    //     type: String,
    //     enum: ['percentage', 'fixed'],
    //     required: true
    // },
    // discountAmount: {
    //     type: Number,
    //     required: true
    // },
    offerPercentage: {
        type: Number,
        required: true
    },
    minimumPurchase: {
        type: Number,
        default: 0
    },
    maximumDiscount: {
        type: Number,
        default: null
    },
    startDate: {
        type: Date,
        required: true
    },
    expiryDate: {
        type: Date,
        required: true
    },
    usageLimit: {
        type: Number,
        default: null
    },
    usedCount: {
        type: Number,
        default: 0
    },
    usedBy: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        usedAt: {
            type: Date,
            default: Date.now
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Add index for faster queries
couponSchema.index({ code: 1 });
couponSchema.index({ expiryDate: 1 });
couponSchema.index({ isActive: 1 });

module.exports = mongoose.model('Coupon', couponSchema);

// const mongoose = require("mongoose");
// const { Schema } = mongoose;

// const couponSchema = new Schema({
//   name: {
//     type: String,
//     required: true,
//     unique: true 
//   },
//   createdOn: {
//     type: Date,
//     default: Date.now,
//     required: true
//   },
//   expireOn: {
//     type: Date,
//     required: true
//   },
//   offerPrice: {
//     type: Number,
//     required: true
//   },
//   minimumPrice: {
//     type: Number
//   },
//   isList: {
//     type: Boolean,
//     default: true
//   },
//   userId: [{
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//   }]
// })

// const Coupon = mongoose.model("Coupon", couponSchema);
// module.exports=Coupon;