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
    stock: {
        type: Number,
        default: 0,
        required:true,
    },
    productImage: {
        type: [String],
        required: true,
    },
    isListed: {
        type: Boolean,
        default: true,
    },
    maxDiscount: {
        type: Number,
        required: false
    },
    isAvailable: {
        type: String,
        enum: ["Available", "Out of Stock", "Only Few Left"],
        required: true,
        default: "Available"
    },
    rating:{
        type:Number,
        required:false,
        default:0
    },
    isFeatured:{
        type:Boolean,
        default:false
    },
    popularity:{
        type: Number,
        default: 0
    }
}, { timestamps: true });
    
const Product = mongoose.model("Product", productSchema);

module.exports = Product;
