const Razorpay = require('razorpay');
const crypto = require('crypto');
const Orders = require('../models/orderSchema');
const Products = require('../models/productSchema');
const User = require('../models/userSchema');
const Address = require('../models/addressSchema');
const Carts = require('../models/cartSchema');
const httpStatus = require('../config/statusCode');
const MESSAGES = require('../config/strings')
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
            amount: amount * 100, 
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
            key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_OYHXIdhBCUDwEK'
            // finalAmount: order.amount - totalDiscount - couponDiscount
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ success: false, message: 'Failed to create order' });
    }
};

exports.verifyPayment = async (req, res) => {
    try {
        console.log("verifyPayment called");
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderData,
        } = req.body;
        let paymentStatus = req.body.paymentStatus

        console.log("Request body:", req.body);
        // console.log("Session user:", req.session.user);

        //verify signature
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
            const user = await User.findById(req.session.user._id);
            console.log("Found user:", user._id);
            if (!user) {
                throw new Error('User not found');
            }
            console.log("Order data", orderData)
            const addressDoc = await Address.findOne({
                userId: user._id,
                'address._id': orderData.addressId
            });
            // console.log("Found address document:", addressDoc);

            if (!addressDoc) {
                throw new Error('Delivery address not found');
            }

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
                console.log("Processing single product order");
                const product = await Products.findById(orderData.singleProductId).populate('category');
                if (!product) {
                    throw new Error('Product not found');
                }
                if (product.stock < orderData.quantity) {
                    throw new Error('Not enough stock available');
                }
                console.log("Found product:", product);
                const prices = calculateOrderItemPrices({
                    product: product,
                    quantity: orderData.quantity
                });
                orderedItems = [{
                    product: product._id,
                    quantity: orderData.quantity,
                    priceAtPurchase: prices.pricePerUnit,
                    total: prices.totalPrice,
                    totalDiscount: prices.totalDiscount
                }];

                //update product stock
                await Products.findByIdAndUpdate(product._id, {
                    $inc: { stock: -parseInt(orderData.quantity) }
                });
                console.log(`Updated stock for product ${product._id}, reduced by ${orderData.quantity}`);
            } else {
                console.log("cart order");
                const cart = await Carts.findOne({ userId: user._id }).populate('items.productId');
                if (!cart || !cart.items || cart.items.length === 0) {
                    throw new Error('Cart is empty');
                }
                //check available stock 
                for (const item of cart.items) {
                    const product = await Products.findById(item.productId._id);
                    if (!product || product.stock < item.quantity) {
                        throw new Error(`Not enough stock available for product ${product ? product.productName : item.productId._id}`);
                    }
                }
                
                orderedItems = cart.items.map(item => {
                    const prices= calculateOrderItemPrices({
                        product: item.productId,
                        quantity: item.quantity
                    });
                    return {
                        product: item.productId._id,
                        quantity: item.quantity,
                        priceAtPurchase: prices.pricePerUnit
                        // priceAtPurchase: item.productId.price
                    }
                });

                console.log("Ordered items:", orderedItems);
                //update product stock
                for (const item of cart.items) {
                    await Products.findByIdAndUpdate(item.productId._id, {
                        $inc: { stock: -parseInt(item.quantity) }
                    });
                    console.log(`Updated stock for product ${item.productId._id}, reduced by ${item.quantity}`);
                }
                //clear cart
                await Carts.findOneAndUpdate(
                    { userId: user._id },
                    { $set: { items: [] } }
                );
                console.log("Cart cleared after successful order");
            }


            //create order obj
            const orderDoc = {
                userId: user._id,
                orderId: razorpay_payment_id,
                orderedItems: orderedItems,
                status: paymentStatus === "Failed" ? "Pending" : 'Order Placed',
                finalAmount: orderData.total,
                totalDiscount: orderData.totalDiscount,
                couponDiscount: orderData.couponDiscount,
                couponCode: orderData.couponCode,
                address: {
                    name: selectedAddress.name,
                    mobile: user.mobile,
                    pincode: selectedAddress.pincode,
                    streetAddress: selectedAddress.streetAddress,
                    address: selectedAddress.streetAddress,
                    city: selectedAddress.city,
                    state: selectedAddress.state,
                    alternatePhone: selectedAddress.mobile || user.mobile
                },
                paymentStatus: paymentStatus === 'Failed' ? "Failed" : "Paid",
                paymentId: razorpay_payment_id,
                paymentMethod: 'Online Payment'
            };

            console.log("Creating order with:", orderDoc);

            const order = new Orders(orderDoc);
            const savedOrder = await order.save();
            console.log("Order saved successfully:", savedOrder);

            if (paymentStatus === "Failed") {
                console.log(MESSAGES.PAYMENT_FAILED);
                if (orderData.buyNow) {
                    const product = await Products.findById(orderData.singleProductId);
                    await Products.findByIdAndUpdate(product._id, {
                        $inc: { stock: parseInt(orderData.quantity) }
                    });
                    console.log(`Updated stock for product ${product._id} after payment fail, stock increased by ${orderData.quantity}`);
                } else {
                    const order = await Orders.findOne({ 
                        userId: user._id,
                        status:"Pending",
                        paymentStatus:"Failed" 
                    })
                    .sort({ createAt: -1})
                    .populate('orderedItems.product');

                    if (!order) {
                        console.log("No pending order found for user:", user._id);
                        return res.status(404).json({ success: false, message: "No pending order found" });
                    }

                    //update product stock
                    for (const item of order.orderedItems) {
                        await Products.findByIdAndUpdate(item.product._id, {
                            $inc: { stock: parseInt(item.quantity) }
                        });
                        console.log(`Updated stock for product ${item.product._id} after payment fail, stock increased by ${item.quantity}`);
                    }
                    //create cart items array from order items
                    const cartItems = order.orderedItems.map(item => ({
                        productId: item.product._id,
                        quantity: item.quantity,
                        priceAtPurchase: item.product.price
                    }));
                    console.log("Cart items:", cartItems);
                    //update cart with the org items
                    await Carts.findOneAndUpdate(
                        { userId: user._id },
                        { $set: { items: cartItems } }
                    );
                    console.log("Cart restored with original items after failed order");
                }

                return res.status(200).json({ success: false, message: MESSAGES.PAYMENT_FAILED, order: savedOrder })
            }
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
            message: error.message || MESSAGES.PAYMENT_FAILED,
            error: error.stack
        });
    }
};

exports.retryPayment = async (req, res) => {
    try {
        console.log('retryPayment called')
        const user = await User.findById(req.session.user._id);
        const { orderId } = req.body;
        const orderDetails = await Orders.findById(orderId)
            .populate({
                path: 'orderedItems.product',
                select: 'productName stock priceAtPurchase'
            });
        console.log("orderDetails in retryPayment",orderDetails)
            if (!orderDetails) {
                return res.status(404).json({
                    success: false,
                    message: 'Order not found'
                });
            }

        const isBuyNow = orderDetails.orderedItems.length === 1;
        if (isBuyNow) {
            const item = orderDetails.orderedItems[0];
            if (!item.product || item.product.stock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: 'Product out of stock',
                    insufficientStockItems: [{
                        productName: item.product ? item.product.productName : 'Product Not Found',
                        requestedQuantity: item.quantity,
                        availableStock: item.product ? item.product.stock : 0
                    }]
                });
            }

            const prices = calculateOrderItemPrices({
                product: item.product,
                quantity: item.quantity
            });
            orderedItems = [{
                product: item.product._id,
                quantity: item.quantity,
                priceAtPurchase: prices.pricePerUnit,
                total: prices.totalPrice,
                totalDiscount: prices.totalDiscount
            }];
            console.log("orderedItems in retryPayment buy now",orderedItems)
            await Products.findByIdAndUpdate(item.product._id, {
                $inc: { stock: -parseInt(item.quantity) }
            });
            console.log(`Reduced stock for buy now product ${item.product._id} for retry payment, decreased by ${item.quantity}`);

        } else {
            const insufficientStockItems = [];
            for (const item of orderDetails.orderedItems) {
                if (!item.product || item.product.stock < item.quantity) {
                    insufficientStockItems.push({
                        productName: item.product ? item.product.productName : 'Product Not Found',
                        requestedQuantity: item.quantity,
                        availableStock: item.product ? item.product.stock : 0
                    });
                }
            }
            console.log("insufficientStockItems",insufficientStockItems)
            if (insufficientStockItems.length > 0) {
                return res.status(200).json({
                    success: false,
                    message: 'Some items have insufficient stock',
                    insufficientStockItems
                });
            }
            const cart = await Carts.findOne({ userId: user._id }).populate('items.productId');
                if (!cart || !cart.items || cart.items.length === 0) {
                    throw new Error('Cart is empty');
                }
                //check available stock 
                for (const item of cart.items) {
                    const product = await Products.findById(item.productId._id);
                    if (!product || product.stock < item.quantity) {
                        throw new Error(`Not enough stock available for product ${product ? product.productName : item.productId._id}`);
                    }
                }
            orderedItems = cart.items.map(item => ({
                product: item.productId._id,
                quantity: item.quantity,
                priceAtPurchase: item.productId.price
            }));
            console.log("orderedItems in retryPayment cart",orderedItems)
            for (const item of orderDetails.orderedItems) {
                if (item.product) {
                    await Products.findByIdAndUpdate(item.product._id, {
                        $inc: { stock: -parseInt(item.quantity) }
                    });
                    console.log(`Reduced stock for cart product ${item.product._id} for retry payment, decreased by ${item.quantity}`);
                }
            }
            await Carts.findOneAndUpdate(
                { userId: user._id },
                { $set: { items: [] } }
            );
        }
        // const insufficientStockItems = [];
        // for (const item of orderDetails.orderedItems) {
        //     if (!item.product || item.product.stock < item.quantity) {
        //         insufficientStockItems.push({
        //             productName: item.product ? item.product.productName : 'Product Not Found',
        //             requestedQuantity: item.quantity,
        //             availableStock: item.product ? item.product.stock : 0
        //         });
        //     }
        // }
        // if (insufficientStockItems.length > 0) {
        //     return res.status(400).json({
        //         success: false,
        //         message: 'Some items have insufficient stock',
        //         insufficientStockItems
        //     });
        // }

        const amount = Math.round(orderDetails.finalAmount*100);
        const options = {
            amount: amount,
            currency: "INR",
            receipt: orderId  
            // `order_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);
        console.log("order",order)
        res.json({
            success: true,
            id: order.id,
            order: order,
            amount: amount,
            // order.amount,
            key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_OYHXIdhBCUDwEK'
        });
    } catch (error) {
        console.error('Error creating retry payment:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error processing retry payment',
            error: error.message 
        });
    }
};

async function restoreProductStock(orderData) {
    try {
        console.log('restoreProductStock() called')
        if (orderData.buyNow) {
            const product = await Products.findById(orderData.singleProductId);
            await Products.findByIdAndUpdate(product._id, {
                $inc: { stock: parseInt(orderData.quantity) }
            });
            console.log(`Restored stock for product ${product._id} after failed retryPayment, increased by ${orderData.quantity}`);
        } else {
            // Handle cart scenario
            const order = await Orders.findOne({ 
                userId: orderData.userId,
                status: "Pending",
                paymentStatus: "Failed" 
            }).sort({ createdAt: -1 }).populate('orderedItems.product');

            if (!order) {
                console.log("No pending order found for user:", orderData.userId);
                return res.status(404).json({ success: false, message: "No pending order found" });
            }
             // Restore stock for each ordered item
             for (const item of order.orderedItems) {
                await Products.findByIdAndUpdate(item.product._id, {
                    $inc: { stock: parseInt(item.quantity) }
                });
                console.log(`Restored stock for product ${item.product._id} after failed retryPayment, increased by ${item.quantity}`);
            }

            // Create cart items array from order items
            const cartItems = order.orderedItems.map(item => ({
                productId: item.product._id,
                quantity: item.quantity,
                priceAtPurchase: item.product.price
            }));
            console.log("Cart items in restoreProductStock :", cartItems);
            // Update cart with the original items
            await Carts.findOneAndUpdate(
                { userId: orderData.userId },
                { $set: { items: cartItems } }
            );
            console.log("Cart restored with original items after failed order");
        }
  
        // const order = await Orders.findById(orderId).populate('orderedItems.product');
        // if (!order) return;

        // Restore stock for each ordered item
        // for (const item of orderData.orderedItems) {
        //     if (item.product) {
        //         await Products.findByIdAndUpdate(
        //             item.product._id,
        //             { $inc: { stock: item.quantity } }
        //         );
        //     }
        // }
    } catch (error) {
        console.error('Error restoring stock:', error);
    }
}

exports.verifyRetryPayment = async (req, res) => {
    try {
        console.log("verifyRetryPayment called")
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderId,
            paymentStatus
        } = req.body;

        const orderData = await Orders.findById(orderId);
        console.log("Order data:", orderData);

        if (paymentStatus === "Failed") {
            console.log('payment status failed')
            await restoreProductStock(orderData);
            return res.status(400).json({
                success: false,
                message: MESSAGES.PAYMENT_FAILED
            });
        }

        // const orderData = await Orders.findById(orderId)
        // console.log("order body:", orderData);
        // console.log("Session user:", req.session.user);

        //verify signature
        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature !== expectedSign) {
            await restoreProductStock(orderData);
            console.log("Signature verification failed");
            return res.status(400).json({ success: false, message: "Invalid signature" });
        }

        console.log("Signature verified successfully");

        await Orders.findByIdAndUpdate(
            orderId,
            {
                $set: {
                    status: 'Order Placed',
                    paymentStatus: 'Paid',
                    razorpay_order_id,
                    razorpay_payment_id,
                    razorpay_signature
                }
            }
        );
        // orderData.paymentStatus = "Paid"
        // orderData.status = "Order Placed"
        // await orderData.save()
        return res.status(200).json({ success: true, message: "Payment verified successfully" })
    } catch (error) {
        console.error('Payment verification error:', error);
        if (req.body.orderId) {
            const orderData = await Orders.findById(req.body.orderId);
            await restoreProductStock(orderData); // Restore stock if there's an error
        }

        res.status(500).json({
            success: false,
            message: error.message || MESSAGES.PAYMENT_FAILED,
            error: error.stack
        });
    }
}

