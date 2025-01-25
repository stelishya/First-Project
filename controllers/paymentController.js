const Razorpay = require('razorpay');
const crypto = require('crypto');
const Orders = require('../models/orderSchema');
const Products = require('../models/productSchema');
const User = require('../models/userSchema');
const Address = require('../models/addressSchema');
const Carts = require('../models/cartSchema');
require('dotenv').config();

const { calculateOrderItemPrices } = require('../helpers/priceCalculator');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

exports.createOrder = async (req, res) => {
    try {
        console.log("createOrder called")
        const { amount, couponDiscount = 0 } = req.body;
        const options = {
            amount: amount * 100, // amount in smallest currency unit (paise)
            currency: "INR",
            receipt: `order_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);
        res.json({
            success: true,
            id: order.id,
            amount: order.amount,
            // totalDiscount,
            couponDiscount,
            key_id: process.env.RAZORPAY_KEY_ID || 'your_razorpay_key_id'
            // finalAmount: order.amount - totalDiscount - couponDiscount
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
            orderData,
        } = req.body;
        let paymentStatus = req.body.paymentStatus

        console.log("Request body:", req.body);
        // console.log("Session user:", req.session.user);

        // Verify signature
        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature !== expectedSign) {
            console.log("Signature verification failed");
            paymentStatus = "Failed"
            // return res.status(400).json({ success: false, message: "Invalid signature" });
        }

        console.log("Signature verified successfully");

        try {
            // Get user details
            const user = await User.findById(req.session.user._id);
            console.log("Found user:", user._id);
            if (!user) {
                throw new Error('User not found');
            }
            console.log("Order data", orderData)
            // Get address details
            const addressDoc = await Address.findOne({ 
                userId: user._id,
                'address._id': orderData.addressId 
            });
            // console.log("Found address document:", addressDoc);

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

            let orderedItems = [];

            // let totalDiscount = 0;

            if (orderData.buyNow) {
                // Single product order
                console.log("Processing single product order");
                const product = await Products.findById(orderData.singleProductId);
                if (!product) {
                    throw new Error('Product not found');
                }
                if (product.stock < orderData.quantity) {
                    throw new Error('Not enough stock available');
                }
                // Calculate discount for single product
                // totalDiscount = (product.mrp - product.price) * orderData.quantity;
                // console.log(`Single product discount: ${totalDiscount}`);

            // Get product details
            // console.log("Getting product details for:", orderData.singleProductId);
            // const product = await Products.findById(orderData.singleProductId);
            console.log("Found product:", product);
            const prices = calculateOrderItemPrices({
                product: product,
                quantity: orderData.quantity
            });
            orderedItems = [{
                product: product._id,
                quantity: orderData.quantity,
                priceAtPurchase:  prices.pricePerUnit,
                total: prices.totalPrice,
                totalDiscount: prices.totalDiscount
            }];

            // Update product stock
            await Products.findByIdAndUpdate(product._id, {
                $inc: { stock: -parseInt(orderData.quantity) }
            });
            console.log(`Updated stock for product ${product._id}, reduced by ${orderData.quantity}`);
            }else{
                // Cart order
                console.log("Processing cart order");
                const cart = await Carts.findOne({ userId: user._id }).populate('items.productId');
                if (!cart || !cart.items || cart.items.length === 0) {
                    throw new Error('Cart is empty');
                }
                 // Check stock availability for all items
                 for (const item of cart.items) {
                    const product = await Products.findById(item.productId._id);
                    if (!product || product.stock < item.quantity) {
                        throw new Error(`Not enough stock available for product ${product ? product.productName : item.productId._id}`);
                    }
                    // Calculate discount for each cart item
                    // totalDiscount += (item.productId.mrp - item.productId.price) * item.quantity;
                }
                // console.log(`Cart total discount: ${totalDiscount}`);

                 // Process each cart item
                 orderedItems = cart.items.map(item => ({
                    product: item.productId._id,
                    quantity: item.quantity,
                    priceAtPurchase: item.productId.price
                }));

                // Update product stock
                for (const item of cart.items) {
                    await Products.findByIdAndUpdate(item.productId._id, {
                        $inc: { stock: -parseInt(item.quantity) }
                    });
                    console.log(`Updated stock for product ${item.productId._id}, reduced by ${item.quantity}`);
                }
                 // Clear the cart
                 await Carts.findOneAndUpdate(
                    { userId: user._id },
                    { $set: { items: [] } }
                );
                console.log("Cart cleared after successful order");
            }


            // Create order object
            const orderDoc = {
                userId: user._id,
                orderId: razorpay_payment_id,
                orderedItems:orderedItems,
                status: paymentStatus === "Failed" ?  "Pending":'Order Placed',
                finalAmount: orderData.total,
                totalDiscount: orderData.totalDiscount,
                couponDiscount: orderData.couponDiscount,
                couponCode: orderData.couponCode,
                address: {
                    name: selectedAddress.name,
                    mobile: user.mobile, 
                    pincode: selectedAddress.pincode,
                    locality: selectedAddress.streetAddress,
                    address: selectedAddress.streetAddress,
                    city: selectedAddress.city,
                    state: selectedAddress.state || 'Not Specified',
                    alternatePhone: selectedAddress.mobile || user.mobile
                },
                paymentStatus: paymentStatus === 'Failed' ? "Failed": "Paid",
                paymentId: razorpay_payment_id,
                paymentMethod: 'Online Payment'
            };

            console.log("Creating order with:", orderDoc);

            const order = new Orders(orderDoc);
            const savedOrder = await order.save();
            console.log("Order saved successfully:", savedOrder);

            if(paymentStatus === "Failed" )return res.status(200).json({success:false, message:"Payment Verification Failed", order:savedOrder})
            res.json({ 
                success: true, 
                message: 'Payment verified and order created',
                orderId: savedOrder._id,
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

exports.retryPayment = async (req,res)=>{
    try {
        const { orderId } = req.body;
        const orderDetails = await Orders.findById(orderId);
        const amount = orderDetails.finalAmount;
        const options = {
            amount: amount * 100, // amount in smallest currency unit (paise)
            currency: "INR",
            receipt: `order_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);
        res.json({
            success: true,
            id: order.id,
            amount: order.amount,
            // totalDiscount,
            // couponDiscount,
            key_id: process.env.RAZORPAY_KEY_ID || 'your_razorpay_key_id'
            // finalAmount: order.amount - totalDiscount - couponDiscount
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ success: false, message: 'Failed to create order' });
    }
};

exports.verifyRetryPayment = async(req,res)=>{
    try {
        const { 
            razorpay_order_id, 
            razorpay_payment_id, 
            razorpay_signature,
            orderId,
        } = req.body;

        const orderData = await Orders.findById(orderId)
        console.log("order body:", orderData);
        // console.log("Session user:", req.session.user);

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

        orderData.paymentStatus = "Paid"
        orderData.status = "Order Placed"
        await orderData.save()
        return res.status(200).json({success:true})
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Payment verification failed',
            error: error.stack
        });
    }
}

exports.orderCreate = async (req,res)=>{
    try {
        console.log("orderCreate called")
        const { razorpayOrderData,paymentStatus } = req.body;
        console.log("req.body :",req.body)
    } catch (error) {
        
    }
}