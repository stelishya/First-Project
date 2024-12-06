const mongoose=require('mongoose');
const {Schema}=mongoose;

const productSchema = new Schema({
    productName: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
        required: true,
    },
    mrp: {
        type: Number,
        required: true,
    },
    productOffer: {
        type: Number,
        default: 0,
    },
    quantity: {
        type: Number,
        default: 0,
    },
    productImage: {
        type: [String],
        required: true,
    },
    isListed: {
        type: Boolean,
        default: true,
    },
    status: {
        type: String,
        enum: ["Available", "out of stock", "Discontinued"],
        required: true,
        default: "Available",
    },
}, { timestamps: true });
    
const Product = mongoose.model("Product", productSchema);

module.exports = Product;
