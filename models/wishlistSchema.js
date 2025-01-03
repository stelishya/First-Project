const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    products: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, { timestamps: true });

module.exports = mongoose.model('Wishlist', wishlistSchema);


// const mongoose = require("mongoose");
// const { Schema } = mongoose;

// const wishlistSchema = new Schema({
//     userId: {
//         type: Schema.Types.ObjectId,
//         ref: "Product",
//         required: true,
//       },
//       products: [{
//         productId: {
//           type: Schema.Types.ObjectId,
//           ref: "Product",
//           required: true 
//         },
//         addedOn: {
//           type: Date,
//           default: Date.now
//         }
//       }]
// });

// const Wishlist = mongoose.model("Wishlist", wishlistSchema);
// module.exports=Wishlist;
