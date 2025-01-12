const Carts = require('../models/cartSchema')
const Orders = require('../models/orderSchema')
const Addresses = require('../models/addressSchema')
const Users = require('../models/userSchema')
const Products = require('../models/productSchema')
const Wallets = require('../models/walletSchema')
const PDFDocument = require('pdfkit');
const { calculateOrderItemPrices ,calculateTotals} = require('../helpers/priceCalculator');
// const mongoose = require('mongoose');

exports.checkout = async (req, res) => {
    try {
        const search = req.query.search || ''
        const session = req.session.user;
        const userId = session._id;
        if (!req.session || !req.session.user || !req.session.user._id) {
            return res.redirect('/user/login');
        }

        const { productId, quantity, buyNow } = req.body;
        let products, totalMRP = 0, totalDiscount = 0, totalAmount = 0;
        let isBuyNow = false;

        if (buyNow && productId) {
            // Handle Buy Now
            isBuyNow = true;
            const productDetails = await Products.findById(productId).populate('category');
            if (!productDetails) {
                return res.redirect('/user/products');
            }

            const itemPrices = calculateOrderItemPrices({
                product: productDetails,
                quantity: Number(quantity) || 1
            });

            products = [{
                productId: {
                    ...productDetails.toObject(),
                    productImage: productDetails.productImage,
                    productName: productDetails.productName
                },
                quantity: Number(quantity) || 1,
                prices: itemPrices
            }];

            totalMRP = itemPrices.originalPrice * quantity;
            // (Number(quantity) || 1);
            totalDiscount = itemPrices.totalDiscount;
            totalAmount = itemPrices.totalPrice;

            // Store in session for later use
            req.session.buyNow = {
                products,
                totalMRP,
                totalDiscount,
                totalAmount,
                productId: productId, 
                quantity: Number(quantity) || 1,
                // isBuyNow: true
            };
            console.log("Setting buyNow session:", req.session.buyNow);
        } else {
            // Handle Cart Checkout
            isBuyNow = false;
            const cart = await Carts.findOne({ userId }).populate({
                path: 'items.productId',
                populate: {
                    path: 'category',
                    select: 'name categoryOffer'
                }
            });

            if (!cart || !cart.items || cart.items.length === 0) {
                return res.redirect('/user/cart');
            }
            
            // Calculate prices for each cart item
            products = cart.items.map(item => {
                const itemPrices = calculateOrderItemPrices({
                    product: item.productId,
                    quantity: item.quantity
                });

                totalMRP += itemPrices.originalPrice * item.quantity;
                totalDiscount += itemPrices.totalDiscount;
                totalAmount += itemPrices.totalPrice;

                return {
                    productId: {
                        ...item.productId.toObject(),
                        productImage: item.productId.productImage,
                        productName: item.productId.productName
                    },
                    quantity: item.quantity,
                    prices: itemPrices
                };
            });
        }
        // // Fetch user's addresses
        // const addressDoc = await Addresses.findOne({ userId });
        // let addresses = [];

        // if (addressDoc && addressDoc.address) {
        //     addresses = addressDoc.address.map(addr => ({
        //         _id: addr._id,
        //         name: addr.name,
        //         streetAddress: addr.streetAddress,
        //         city: addr.city,
        //         state: addr.state,
        //         country: addr.country,
        //         pincode: addr.pincode,
        //         phone: addr.mobile,
        //         typeOfAddress: addr.typeOfAddress
        //     }));
        // }
        // Get user's addresses
        const addresses = await Addresses.findOne({ userId });

        // Get available payment methods
        const wallet = await Wallets.findOne({ userId });
        const walletBalance = wallet ? wallet.balance : 0;

        //const paymentMethods = Orders.schema.path('paymentMethod').enumValues;
        const paymentMethods = ['Online Payment', 'Cash on Delivery'];
        if (walletBalance > 0) {
            paymentMethods.push('Wallet');
        }

        // finalAmount = finalAmount || 0; 
        console.log("Checkout data:", {
            products,
            totalMRP,
            totalDiscount,
            totalAmount,
            isBuyNow
        });

        res.render('users/order/checkout', {
            session,
            search,
            addresses: addresses ? addresses.address : [],
            products,
            totalMRP,
            totalDiscount,
            totalAmount,
            walletBalance,
            paymentMethods,
            isBuyNow
        });

    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).send('Error processing checkout');
    }
};

exports.orderCreation = async (req, res) => {
    console.log("orderCreation called", req.session.user._id)
    const userId = req.session.user._id;
    const orderData = req.body;
    console.log("orderData:", orderData);
    try {
        if (!orderData.addressId) {
            return res.status(400).json({ message: "Please select a delivery address" });
        }

        const userAddressDoc = await Addresses.findOne({ userId: userId });
        if (!userAddressDoc) {
            return res.status(400).json({success:false, message: "No addresses found for user" });
        }

        const selectedAddress = userAddressDoc.address.find(addr => addr._id.toString() === orderData.addressId);
        if (!selectedAddress) {
            return res.status(400).json({success:false, message: "Invalid delivery address" });
        }

        let subtotal, productsWithLatestPrices, totalDiscountAmount;
        if (orderData.buyNow) {
            console.log("Processing Buy Now order");
            if (!orderData.singleProductId) {
                return res.status(400).json({ success: false, message: "Product ID is required for buy now order" });
            }

            const product = await Products.findById(orderData.singleProductId).populate('category');
            if (!product) {
                return res.status(400).json({ success: false, message: "Product not found" });
            }
            //helper function
            const prices = calculateOrderItemPrices({
                product,
                quantity: parseInt(orderData.quantity) || 1
            });
            subtotal = prices.totalPrice;
            totalDiscountAmount = prices.totalDiscount;
            productsWithLatestPrices = [{
                productId: product._id,
                quantity: parseInt(orderData.quantity) || 1,
                priceAtPurchase: prices.pricePerUnit,
                totalDiscount: prices.totalDiscount
            }];
            console.log("Buy Now order details:", {
                subtotal,
                totalDiscountAmount,
                productsWithLatestPrices
            });
        } else {
            console.log("Processing Cart order");
            const cart = await Carts.findOne({ userId })
                .populate({
                    path: 'items.productId',
                    populate: {
                        path: 'category',
                        model: 'Category'
                    }
                });
            console.log("cart :", cart)
            if (!cart || !cart.items || cart.items.length === 0) {
                return res.status(400).json({ success: false, message: "Cart is empty" });
            }
            //helper function
            productsWithLatestPrices = cart.items.map(item => {
                const prices = calculateOrderItemPrices({
                    product: item.productId,
                    quantity: item.quantity
                });
                return {
                    productId: item.productId._id,
                    quantity: item.quantity,
                    priceAtPurchase: prices.pricePerUnit,
                    totalDiscount: prices.totalDiscount
                };
            });
            const totals = calculateTotals(cart.items);
            subtotal = totals.subtotal;
            totalDiscountAmount = totals.totalDiscount;
            
            console.log("\nSubtotal:", subtotal);
            console.log("\nTotal Discount Amount:", totalDiscountAmount);
            console.log("Cart order details:", {
                subtotal,
                totalDiscountAmount,
                productsWithLatestPrices
            });
        }

        // Non-wallet payment
        try {
            const orderItems = productsWithLatestPrices.map(item => ({
                product: item.productId,
                quantity: item.quantity,
                // price: item.priceAtPurchase,
                priceAtPurchase: item.priceAtPurchase,
                totalDiscount: item.totalDiscount
            }));
            console.log("orderItems : ", orderItems)
            // totalDiscountAmount = isNaN(totalDiscountAmount) ? 0 : totalDiscountAmount;
            const newOrder = new Orders({
                userId: userId,
                address: selectedAddress._id || 'address',
                orderedItems: orderItems,
                finalAmount: subtotal,
                totalDiscount: totalDiscountAmount,
                status: 'Order Placed',
                paymentType: orderData.paymentType || 'Cash on Delivery'
            });
            console.log("Creating order with data:", newOrder);
            await newOrder.save();
            console.log("Order saved successfully.");

            console.log("orderData.buyNow : ", orderData.buyNow)
            // Update inventory
            if (orderData.buyNow) {
                console.log("Updating stock for Buy Now order");
                await Products.findByIdAndUpdate(orderData.singleProductId, {
                    $inc: { stock: -orderData.quantity }
                });
                console.log("Inventory updated for buy now.");
            } else {
                console.log("Updating stock for Cart order");
                await Carts.findOneAndUpdate(
                    { userId: userId },
                    { $set: { items: [] } }
                );
                for (const item of productsWithLatestPrices) {
                    await Products.findByIdAndUpdate(item.productId, {
                        $inc: { stock: -item.quantity }
                    });
                }
                
                // await Carts.findOneAndDelete({ userId });
                // const cart = await Carts.findOne({ userId })
                //     .populate('items.productId');
                // console.log("Cart populated for user:", userId);
                // if(cart){
                //     for (const item of cart.items) {
                //         await Products.findByIdAndUpdate(item.productId._id, {
                //             $inc: { quantity: -item.quantity }
                //         });
                //         console.log(`Updated inventory for product ${item.productId._id}, reduced by ${item.quantity}`);
                //     }
                //     await Carts.findOneAndDelete({ userId });
                // }
            }
            return res.status(200).json({
                success: true,
                message: "Order placed successfully",
                order: newOrder._id
            });
        } catch (error) {
            console.error("Error during order creation:", error);
            res.status(500).json({ success: false, message: "Failed to create order: " + error.message });
        }
    } catch (error) {
        console.error("Error creating order:", error);
        return res.status(500).json({ success: false, message: "Error creating order: " + error.message });
    }
}

exports.showOrdersUser = async (req, res) => {
    try {
        console.log("showOrdersUser called")
        const search = req.query.search || '';
        const session = req.session.user
        const userId = session._id
        console.log("userId:", userId)

        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        const orderCount = await Orders.countDocuments({ userId });
        console.log("orderCount:", orderCount);

        const orders = await Orders.find({ userId })
            .populate({
                path: 'orderedItems.product'
            })
            .populate('address')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
        console.log("orders : ", orders)
        const totalOrders = await Orders.countDocuments({ userId });
        console.log("totalOrders:", totalOrders);
        const totalPages = Math.ceil(totalOrders / limit);
        console.log("totalOrders : " + totalOrders + "\ntotalPages : " + totalPages)
        res.render('users/dashboard/order folder/orders', {
            orders,
            totalOrders,
            search,
            page,
            limit,
            totalPages,
            session,
            activeTab: 'orders'
        })
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Error fetching orders');
    }
}

exports.orderDetailsUser = async (req, res) => {
    try {
        console.log("orderDetailsUser called")
        const search = req.query.search || '';
        const orderId = req.params.orderId
        const session = req.session.user
        const order = await Orders.findById(orderId).populate({
            path: "orderedItems.product",
            populate: {
                path: "category",
                model: "Category"
            }
        });
        if (!order) {
            console.error(`Order not found for ID: ${orderId}`);
            return res.status(404).render('page-404', { message: "Order not found." });
        }

        order.orderedItems = order.orderedItems.map(item => {
            const prices = calculateOrderItemPrices(item);
            console.log("prices:",prices.totalDiscount)
            return {
                ...item.toObject(),
                priceAtPurchase: prices.pricePerUnit,
                discountPercentage: prices.discountPercentage,
                totalDiscount:prices.totalDiscount
            };
        });
        
        // console.log("orderId : ", orderId, "\nsession : ", session, "\norder : ", order);
        res.render('users/dashboard/order folder/order_details', {
            order, session, activeTab: 'orders', search
        })
    } catch (error) {
        console.error(error)
        res.status(500).render('users/page-404', { message: "Unable to retrieve order details." });
    }
}

exports.getOrdersAdmin = async (req, res) => {
    try {
        console.log("getOrdersAdmin called")
        let search = req.query.search || '';
        const orderStatuses = Orders.schema.path('status').enumValues;
        const page = parseInt(req.query.page) || 1;
        const limit = 6;
        const skip = (page - 1) * limit;

        const returnRequests = await Orders.find({ 'returnDetails.returnStatus': 'Requested' }).populate({
            path: 'orderedItems.product',
            select: 'name'
        }).populate('userId')

        const orders = await Orders.find({})
            .populate('userId', 'username email')
            .populate({
                path: 'orderedItems.product',
                model: 'Product',
                select: 'productName productImage  priceAtPurchase'
            })
            .sort({ createdAt: -1 }).skip(skip).limit(limit)
        const totalOrders = await Orders.countDocuments();
        const totalPages = Math.ceil(totalOrders / limit);

        res.render('admin/order folder/orders', {
            orders, activeTab: 'orders', orderStatuses, returnRequests,
            page,
            totalPages,
            limit,
            totalOrders,
            search
        });
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ message: "Unable to retrieve orders." });
    }
}

exports.cancelOrder = async (req, res) => {
    try {
        console.log("cancelOrder called");
        const orderId = req.params.orderId;
        const userId = req.session.user._id;
        console.log("orderId : ", orderId);

        // Fetch the order
        const order = await Orders.findById(orderId).populate('orderedItems.product');
        console.log("order : ", order);

        if (!order) {
            return res.status(404).json({ message: "Order not found", success: false });
        }
        if (order.userId.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized to cancel this order'
            });
        }
        // Check if the order is eligible for cancellation
        if (["Cancelled", "Delivered", "Returned"].includes(order.status)) {
            return res.status(400).json({ message: `Order cannot be cancelled when in ${order.status} status`, success: false });
        }

        const currentDate = new Date();
        const refundAmount = order.finalAmount;

        // update order status 
        await Orders.findByIdAndUpdate(orderId, {
            status: "Cancelled",
            cancelledOn: currentDate,
            $push: {
                statusHistory: {
                    status: "Cancelled",
                    date: currentDate,
                    note: "Order cancelled by user"
                }
            }
        });
        const user = await Users.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        console.log('Current wallet balance:', user.wallet);
        const newBalance = (user.wallet || 0) + refundAmount;
        console.log('New wallet balance:', newBalance);
        user.wallet = newBalance;
        const walletTransaction = new Wallets({
            userId: userId,
            orderId: orderId,
            type: 'CREDIT',
            amount: refundAmount,
            description: `Refund for cancelled order #${order.orderId || order._id}`,
            balance: newBalance
        });
        await Promise.all([
            order.save(),
            user.save(),
            walletTransaction.save()
        ]);
        // restore product inventory
        const stockUpdatePromises = order.orderedItems.map(item =>
            Products.findByIdAndUpdate(item.product._id, {
                $inc: { stock: item.quantity }
            })
        );
        await Promise.all(stockUpdatePromises);

        console.log("Order cancelled successfully.Amount added to wallet.");
        res.status(200).json({
            success: true,
            message: "Order cancelled successfully. Amount added to wallet.",
            cancelledOn: currentDate,
            refundAmount,
            newBalance
        });

    } catch (error) {
        console.error("Error cancelling order:", error);
        res.status(500).json({ message: "Failed to cancel order" });
    }
};

exports.updateStatus = async (req, res) => {
    try {
        console.log("updateStatus called")
        const orderId = req.params.orderId;
        const { status } = req.body;
        console.log("orderId : " + orderId + "status : " + status)
        // Fetch the order
        const order = await Orders.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        // Check for valid status transition
        if (status === "Returned") {
            if (order.status !== "Delivered") {
                console.log("Only delivered orders can be returned.")
                return res.status(400).json({ message: "Only delivered orders can be returned." });
            }
        } else if (["Cancelled"].includes(order.status)) {
            console.log("Cancelled orders cannot be updated further.")
            return res.status(400).json({ message: "Cancelled orders cannot be updated further." });
        } else if (["Returned"].includes(order.status)) {
            console.log("Returned orders cannot be updated further.")
            return res.status(400).json({ message: "Returned orders cannot be updated further." });
        }

        // const session = await mongoose.startSession();
        // session.startTransaction();

        try {
            if (status === "Delivered") {
                await Orders.findByIdAndUpdate(
                    orderId,
                    { status, deliveredOn: Date.now() }
                    // { session }
                );
                if (order.paymentMethod === "COD") {
                    await Orders.findByIdAndUpdate(
                        orderId,
                        { paymentStatus: "Success" }
                        // { session}
                    );
                }
            } else if (status === "Cancelled") {
                const isPrepaid = (order.paymentMethod === "Online" || order.paymentMethod === "Wallet") && order.paymentStatus === "Success";

                if (order.orderedItems && order.orderedItems.length > 0) {
                    const updateInventoryPromises = order.orderedItems.map((item) =>
                        Products.findByIdAndUpdate(
                            item.product,
                            { $inc: { inventory: item.quantity } } // Increment inventory
                            // { session }
                        )
                    );
                    await Promise.all(updateInventoryPromises);
                }
                await Orders.findByIdAndUpdate(
                    orderId,
                    { status, cancelledOn: Date.now() },
                    // { session }
                );

                if (isPrepaid && typeof Wallets !== 'undefined') {
                    await Wallets.findOneAndUpdate(
                        { userId: order.userId },
                        {
                            $inc: { balance: order.totalAmount },
                            $push: {
                                transactions: {
                                    type: 'credit',
                                    amount: order.totalAmount,
                                    description: `Refund for cancelled order #${order.orderId}`
                                }
                            }
                        },
                        {
                            // session,
                            new: true,
                            upsert: true
                        }
                    );
                }
            } else if (status === "Returned") {
                await Orders.findByIdAndUpdate(
                    orderId,
                    { status, returnedOn: Date.now() },
                    // { session }
                );
                if (typeof Wallets !== 'undefined') {
                    await Wallets.findOneAndUpdate(
                        { userId: order.userId },
                        {
                            $inc: { balance: order.totalAmount },
                            $push: {
                                transactions: {
                                    type: 'credit',
                                    amount: order.totalAmount,
                                    description: `Refund for returned order #${order.orderId}`
                                }
                            }
                        },
                        {
                            // session,
                            new: true,
                            upsert: true
                        }
                    );
                }
            } else {
                await Orders.findByIdAndUpdate(
                    orderId,
                    { status },
                    // { session }
                );
            }
            // await session.commitTransaction();
            res.status(200).json({ message: "Order status updated successfully." });
        } catch (err) {
            console.error(err)
            // await session.abortTransaction();
            return res.status(500).json({ message: "Failed to update order status." });
        } finally {
            console.log("hai hello")
            // session.endSession();
        }
    } catch (error) {
        console.error("Error updating order status:", error);
        res.status(500).json({ message: "Failed to update order status." });
    }
};

exports.returnOrder = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const returnReason = req.body.returnReason;

        // Validate inputs
        if (!orderId || !returnReason) {
            return res.status(400).json({ message: "Order ID and return reason are required" });
        }

        // Find the order first
        const order = await Orders.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        // Check if order is eligible for return
        if (order.status !== "Delivered") {
            return res.status(400).json({ message: "Only delivered orders can be returned" });
        }

        // Check if return window is still open (7 days)
        const returnWindow = new Date(order.deliveredOn).getTime() + (7 * 24 * 60 * 60 * 1000);
        if (Date.now() > returnWindow) {
            return res.status(400).json({ message: "Return window has expired" });
        }

        // Check if return is already requested
        if (order.returnDetails?.returnRequested) {
            return res.status(400).json({ message: "Return already requested for this order" });
        }

        // Update order with return details
        await Orders.findByIdAndUpdate(orderId, {
            'returnDetails.returnRequested': true,
            'returnDetails.returnReason': returnReason,
            'returnDetails.returnRequestedAt': new Date(),
            'returnDetails.returnStatus': 'Pending'
        });

        res.status(200).json({ message: "Return request sent successfully" });
    } catch (error) {
        console.error("Error in returnOrder:", error);
        res.status(500).json({ message: "Failed to process return request" });
    }
}

exports.approveReturnRequest = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Orders.findByIdAndUpdate(orderId, { 'returnDetails.returnStatus': 'Approved', status: 'Returned' })
        await Wallets.findOneAndUpdate({ userId: order.userId }, {
            $inc: { balance: order.totalAmount },
            $push: {
                transactions: {
                    type: 'credit',
                    amount: order.totalAmount,
                    description: `Refund for returned order #${order.orderId}`
                }
            }
        })
        res.status(200).json({ message: "Return request approved" })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" })
    }
}

exports.rejectReturnRequest = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        await Orders.findByIdAndUpdate(orderId, { 'returnDetails.returnStatus': 'Rejected' })
        res.status(200).json({ message: "Return request rejected" })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" })
    }
}

exports.downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Orders.findById(orderId)
            .populate("orderedItems.product")
            .populate("userId", "username fullname email");
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        if (order.status !== 'Delivered') {
            return res.status(403).send('Invoice is only available for delivered orders');
        }
        // Create a new PDF document
        const doc = new PDFDocument({
            margin: 50,
            font: 'Helvetica' // Use Helvetica font which has better Unicode support
        });

        // Helper function to format currency
        const formatCurrency = (amount) => {
            return `Rs. ${Number(amount).toLocaleString('en-IN', {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2
            })}`;
        };

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${orderId}.pdf`);

        // Pipe the PDF to the response
        doc.pipe(res);

        // Add the invoice header
        doc.fontSize(20).text('INVOICE', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text('CAlliope', { align: 'center' });
        doc.fontSize(10).text('www.calliope.com', { align: 'center' });
        doc.moveDown();

        // Add a horizontal line
        doc.moveTo(50, doc.y)
            .lineTo(550, doc.y)
            .stroke();
        doc.moveDown();

        // Add order details
        doc.fontSize(12).text(`Order ID: #${orderId}`);
        doc.fontSize(10).text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`);
        doc.moveDown();

        // Add customer details
        doc.fontSize(12).text('Customer Details:');
        doc.fontSize(10).text(`Name: ${order.userId.fullname || order.userId.username}`);
        doc.fontSize(10).text(`Email: ${order.userId.email}`);
        doc.moveDown();

        // Add product table headers
        let yPos = doc.y;
        doc.fontSize(10)
            .text('Product', 50, yPos)
            .text('Quantity', 250, yPos)
            .text('Price', 350, yPos)
            .text('Total', 450, yPos);

        // Add a line below headers
        doc.moveTo(50, doc.y + 5)
            .lineTo(550, doc.y + 5)
            .stroke();
        doc.moveDown();

        // Add products
        let totalMRP = 0;
        order.orderedItems.forEach(item => {
            const price = Number(item.price);
            const quantity = Number(item.quantity);
            const total = price * quantity;

            yPos = doc.y;
            doc.fontSize(10)
                .text(item.product.name, 50, yPos, { width: 180 })
                .text(quantity.toString(), 250, yPos)
                .text(formatCurrency(price), 350, yPos)
                .text(formatCurrency(total), 450, yPos);

            totalMRP += Number(item.product.mrp) * quantity;
            doc.moveDown();
        });

        // Add a line above totals
        doc.moveTo(50, doc.y)
            .lineTo(550, doc.y)
            .stroke();
        doc.moveDown();

        // Function to add aligned text
        const addAlignedText = (label, value, y) => {
            doc.text(label, 350, y);
            doc.text(value, 450, y, { align: 'left' });
        };

        // Add totals with proper alignment
        let currentY = doc.y;
        doc.fontSize(10);

        // Subtotal
        addAlignedText('Subtotal:', formatCurrency(totalMRP), currentY);
        currentY += 20;

        // Discount
        if (order.totalDiscountAmount) {
            addAlignedText('Discount:', `-${formatCurrency(Number(order.totalDiscountAmount))}`, currentY);
            currentY += 20;
        }

        // Coupon
        if (order.coupon && order.coupon.discountAmount) {
            addAlignedText(
                `Coupon (${order.coupon.couponCode}):`,
                `-${formatCurrency(Number(order.coupon.discountAmount))}`,
                currentY
            );
            currentY += 20;
        }

        // Final total with a line above
        doc.moveTo(350, currentY)
            .lineTo(550, currentY)
            .stroke();
        currentY += 10;

        doc.fontSize(12);
        addAlignedText('Total Amount:', formatCurrency(Number(order.totalAmount)), currentY);

        // Add footer
        doc.fontSize(10)
            .text('Thank you for shopping with us!', 50, 700, { align: 'center' });

        // Finalize the PDF
        doc.end();
    } catch (error) {
        console.error("Error downloading invoice:", error);
        res.status(500).json({ message: "Failed to download invoice" });
    }
}