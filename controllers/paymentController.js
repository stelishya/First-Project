const Razorpay = require('razorpay');
const crypto = require('crypto');
const Orders = require('../models/orderSchema');
const Products = require('../models/productSchema');
const User = require('../models/userSchema');
const Address = require('../models/addressSchema');
require('dotenv').config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

exports.createOrder = async (req, res) => {
    try {
        const options = {
            amount: req.body.amount * 100, // amount in smallest currency unit (paise)
            currency: "INR",
            receipt: `order_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);
        res.json({
            id: order.id,
            amount: order.amount
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ success: false, message: 'Failed to create order' });
    }
};

exports.verifyPayment = async (req, res) => {
    try {
        console.log("Starting payment verification...");
        const { 
            razorpay_order_id, 
            razorpay_payment_id, 
            razorpay_signature,
            orderData 
        } = req.body;

        console.log("Request body:", req.body);
        console.log("Session user:", req.session.user);

        // Verify signature
        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature !== expectedSign) {
            console.log("Signature verification failed");
            return res.status(400).json({ success: false, message: "Invalid signature" });
        }

        console.log("Signature verified successfully");

        try {
            // Get user details
            const user = await User.findById(req.session.user._id);
            console.log("Found user:", user._id);

            // Get address details
            const addressDoc = await Address.findOne({ 
                userId: user._id,
                'address._id': orderData.addressId 
            });
            console.log("Found address document:", addressDoc);

            if (!addressDoc) {
                throw new Error('Delivery address not found');
            }

            // Find the specific address from the array
            const selectedAddress = addressDoc.address.find(addr => 
                addr._id.toString() === orderData.addressId
            );
            console.log("Selected address:", selectedAddress);

            if (!selectedAddress) {
                throw new Error('Specific address not found in address document');
            }

            // Get product details
            console.log("Getting product details for:", orderData.singleProductId);
            const product = await Products.findById(orderData.singleProductId);
            console.log("Found product:", product);

            if (!product) {
                throw new Error('Product not found');
            }

            // Create order object
            const orderDoc = {
                userId: user._id,
                orderId: razorpay_payment_id,
                orderedItems: [{
                    product: product._id,
                    quantity: orderData.quantity,
                    priceAtPurchase: product.price
                }],
                status: 'Order Placed',
                finalAmount: orderData.total,
                address: {
                    name: selectedAddress.name,
                    mobile: user.mobile, // Using user's mobile as it's not in address schema
                    pincode: selectedAddress.pincode,
                    locality: selectedAddress.streetAddress,
                    address: selectedAddress.streetAddress,
                    city: selectedAddress.city,
                    state: selectedAddress.state || 'Not Specified',
                    alternatePhone: selectedAddress.mobile || user.mobile
                },
                paymentStatus: 'Paid',
                paymentId: razorpay_payment_id,
                paymentMethod: 'Online Payment'
            };

            console.log("Creating order with:", orderDoc);

            const order = new Orders(orderDoc);
            const savedOrder = await order.save();
            console.log("Order saved successfully:", savedOrder);

            res.json({ 
                success: true, 
                message: 'Payment verified and order created',
                order: savedOrder
            });
        } catch (innerError) {
            console.error("Error during order creation:", innerError);
            throw new Error(`Order creation failed: ${innerError.message}`);
        }
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Payment verification failed',
            error: error.stack
        });
    }
};