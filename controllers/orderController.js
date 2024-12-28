const Carts = require('../models/cartSchema')
const Orders = require('../models/orderSchema')
const Addresses = require('../models/addressSchema')
const Users = require('../models/userSchema')
const Products = require('../models/productSchema')
// const Wallets = require('../models/walletSchema')
const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');

exports.checkout = async (req, res) => {
    try {
        // console.log("session : ",session.user)
        const session = req.session.user;
        const userId = session._id;
        if (!req.session || !req.session.user || !req.session.user._id) {
            return res.redirect('/user/login');
        }
        const Id=req.query.productId || null;
        const quantity=req.query.quantity || 1;
        const search = req.query.search || '';
        const buyNow=req.query.buyNow || false;

        let products, totalMRP, totalDiscount, finalAmount;

        if(buyNow && Id){
            const productId = await Products.findById(Id).populate('category');
            req.session.buyNow = {
                products: [{ productId: productId, quantity: quantity }],
                totalMRP: productId.mrp*quantity,
                totalDiscount: 0,
                finalAmount: productId.mrp*quantity,
            };
            products = [{ productId: productId, quantity: quantity }];
            totalMRP = productId.mrp*quantity;
            totalDiscount = 0;
            finalAmount = productId.mrp*quantity;
        }else {
            // Regular cart checkout
            const cart = await Carts.findOne({ userId }).populate('items.productId');
            if (!cart || !cart.items || cart.items.length === 0) {
                return res.redirect('/user/cart');
            }
            products = cart.items;
            totalMRP = cart.totalMRP;
            totalDiscount = cart.totalDiscount;
            finalAmount = cart.finalAmount;
        }

        // Fetch user's addresses
        const addressDoc = await Addresses.findOne({ userId });
        let addresses = [];
        
        if (addressDoc && addressDoc.address) {
            addresses = addressDoc.address.map(addr => ({
                _id: addr._id,
                name: addr.name,
                streetAddress: addr.streetAddress,
                city: addr.city,
                state: addr.state,
                country: addr.country,
                pincode: addr.pincode,
                phone: addr.mobile,
                typeOfAddress: addr.typeOfAddress
            }));
        }

        const paymentMethods = Orders.schema.path('paymentMethod').enumValues;

        finalAmount = finalAmount || 0; 

        res.render('users/order/checkout', {
            products,
            addresses,
            paymentMethods,
            session,
            totalMRP,
            totalDiscount: totalDiscount || 0,
            finalAmount,
            search
        });
    } catch (error) {
        console.error('Error in checkout:', error);
        res.status(500).render('users/page-404', { 
            message: 'Error loading checkout page',
            error: error
        });
    }
};

exports.orderCreation = async (req,res)=>{
    console.log("orderCreation called",req.session.user._id)

    const userId = req.session.user._id;
    // const { finalAmount, paymentType, addressId, singleProductId, productsLength } = req.body;
    const  orderData  = req.body;
    console.log("orderData:", orderData);
    try {
        if (!orderData.addressId) {
            return res.status(400).json({ message: "Please select a delivery address" });
        }
        console.log("orderData.addressId : ",orderData.addressId)
        console.log("userId:", userId);

        const userAddressDoc = await Addresses.findOne({ userId: userId });
        console.log("User's address document:", userAddressDoc);

        if (!userAddressDoc) {
            return res.status(400).json({ message: "No addresses found for user" });
        }

        const selectedAddress = userAddressDoc.address.find(addr => addr._id.toString() === orderData.addressId);
        if (!selectedAddress) {
            return res.status(400).json({ message: "Invalid delivery address" });
        }
        console.log("Found selected address:", selectedAddress);

        let subtotal, productsWithLatestPrices, totalDiscountAmount;
        if(!orderData.buyNow){
            const cart = await Carts.findOne({ userId })
                .populate({
                    path:'items.productId',
                    populate: {
                        path: 'category',
                        model: 'Category'
                    }
                });
                console.log("cart :",cart)
            if (!cart || !cart.items || cart.items.length === 0) {
                return res.status(400).json({ success: false, message: "Cart is empty" });
            }

            productsWithLatestPrices = cart.items.map(item => {
                const product = item.productId;
                console.log("product : ",product)

                const productPercentageDiscount = product.productOffer || 0;
                const categoryPercentageDiscount = product.category ? product.category.categoryOffer || 0 : 0;
                const percentageDiscount = Math.max(productPercentageDiscount, categoryPercentageDiscount);
                
                console.log("productPercentageDiscount: "+productPercentageDiscount+
                    "\ncategoryPercentageDiscount : "+categoryPercentageDiscount+
                    "percentageDiscount : "+percentageDiscount)
                const discountAmount = Math.round((product.mrp * (percentageDiscount / 100)) * 100) / 100;
                const priceAfterPercentageDiscount = Math.round((product.mrp - discountAmount) * 100) / 100;
                    
                console.log("discountAmount : "+discountAmount+
                    "\npriceAfterPercentageDiscount: "+priceAfterPercentageDiscount)
                console.log('product._id : ',product._id)
                console.log('item.quantity : ',item.quantity)
                return {
                    productId: product._id,
                    quantity: item.quantity,
                    priceAtPurchase: priceAfterPercentageDiscount
                };
            });
    
            subtotal = productsWithLatestPrices.reduce((total, item) => {
                return total + (item.priceAtPurchase * item.quantity);
            }, 0);
            console.log("Subtotal:", subtotal);

            totalDiscountAmount = cart.totalAmount - subtotal;
            console.log("Total Discount Amount:", totalDiscountAmount);
        } else if(orderData.buyNow){
            console.log("orderData.buyNow : ",orderData.buyNow)
            if (!orderData.singleProductId) {
                return res.status(400).json({ success: false, message: "Product ID is required for buy now order" });
            }

            const product = await Products.findById( orderData.singleProductId ).populate('category');
            console.log("product : ",product)
            if (!product) {
                return res.status(400).json({ success:false, message: "Product not found" });
            }

            const totalMRP = product.mrp;
            
            const productPercentageDiscount = product.offer || 0;
            const categoryPercentageDiscount = product.category.offer || 0;
            const percentageDiscount = Math.max(productPercentageDiscount, categoryPercentageDiscount);
            console.log("productPercentageDiscount: "+productPercentageDiscount+
                "\ncategoryPercentageDiscount : "+categoryPercentageDiscount+
                "percentageDiscount : "+percentageDiscount)
            const percentageDiscountAmount = Math.round((totalMRP * (percentageDiscount / 100)) * 100) / 100;
            const priceAfterPercentageDiscount = Math.round((totalMRP - percentageDiscountAmount) * 100) / 100;
            console.log("percentageDiscountAmount : "+percentageDiscountAmount+
                "\npriceAfterPercentageDiscount: "+priceAfterPercentageDiscount)
            // Fixed amount discounts
            // const productFixedDiscount = product.fixedAmount || 0;
            // const categoryFixedDiscount = product.category.fixedAmount || 0;
            // const fixedDiscountAmount = Math.max(productFixedDiscount, categoryFixedDiscount);
            
            // totalDiscountAmount = Math.round(Math.max(percentageDiscountAmount, fixedDiscountAmount) * 100) / 100;

            // const priceAfterFixedDiscount = Math.round(Math.max(totalMRP - productFixedDiscount, totalMRP - categoryFixedDiscount) * 100) / 100;
            // const finalDiscountedPrice = Math.round(Math.min(priceAfterPercentageDiscount, priceAfterFixedDiscount) * 100) / 100;
            // const totalPriceAfterDiscount = Math.round(Math.max(0, finalDiscountedPrice) * 100) / 100;
            
            subtotal = priceAfterPercentageDiscount*orderData.quantity;
            console.log("Subtotal:", subtotal);
                console.log("product._id : "+product._id+
                    "orderData.quantity : "+orderData.quantity)
            productsWithLatestPrices = [
                {
                    productId: product._id,
                    quantity: orderData.quantity,
                    priceAtPurchase: subtotal
                }
            ];
            
        }
        // Non-wallet payment
        try {
            const orderItems = productsWithLatestPrices.map(item => ({
                product: item.productId,
                quantity: item.quantity,
                price: item.priceAtPurchase,
            }));
            console.log("orderItems : ",orderItems)
            totalDiscountAmount = isNaN(totalDiscountAmount) ? 0 : totalDiscountAmount;
            newOrder = new Orders({
                userId:userId,
                address:selectedAddress._id ||'address ahn',
                orderedItems: orderItems,
                finalAmount: subtotal ,
                totalDiscount:totalDiscountAmount,
                paymentMethod: orderData.paymentType,
                status:'Order Placed',
            });
            console.log("Creating order with data:", newOrder);

            await newOrder.save();
            console.log("Order saved successfully.");

            
            console.log("orderData.buyNow : ",orderData.buyNow)
            // Update inventory
            if(orderData.buyNow) {
                await Products.findByIdAndUpdate(orderData.singleProductId, {
                    $inc: { quantity: -orderData.quantity }
                });
                console.log("Inventory updated for buy now.");
            } else {
                const cart = await Carts.findOne({ userId })
                    .populate('items.productId');
                console.log("Cart populated for user:", userId);
                if(cart){
                    for (const item of cart.items) {
                        await Products.findByIdAndUpdate(item.productId._id, {
                            $inc: { quantity: -item.quantity }
                        });
                        console.log(`Updated inventory for product ${item.productId._id}, reduced by ${item.quantity}`);
                    }
                    await Carts.findOneAndDelete({ userId });
                }
            }
            return res.status(200).json({ 
                success: true, 
                message: "Order placed successfully",
                order: newOrder
            });
        } catch (error) {
            console.error("Error during order creation or payment processing:", error);
            res.status(500).json({ success: false, message: "Failed to process payment", error: error.message });
        }
    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ success: false, message: "Failed to place order" });
    }
}

exports.showOrdersUser = async (req,res)=>{
    try {
        console.log("showOrdersUser called")
        const search = req.query.search || '';
        const session = req.session.user
        const userId = session._id
        console.log("userId:", userId)

        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        const orderCount = await Orders.countDocuments({userId});
        console.log("orderCount:", orderCount);

        const orders = await Orders.find({userId})
            .populate({
                path: 'orderedItems.product'
            })
            .populate('address')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            console.log("orders : ",orders)
        const totalOrders = await Orders.countDocuments({ userId });
        console.log("totalOrders:", totalOrders);
        const totalPages = Math.ceil(totalOrders / limit);
            console.log("totalOrders : "+totalOrders+"\ntotalPages : "+totalPages)
        res.render('users/dashboard/order folder/orders',{
            orders,
            totalOrders,
            search,
            page,
            limit,
            totalPages,
            session,
            activeTab:'orders'
        })
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Error fetching orders');
    }
}

exports.orderDetailsUser = async (req,res)=>{
    try {
        console.log("orderDetailsUser called")
        const search = req.query.search || '';
        const orderId = req.params.orderId
        const session = req.session.user
        const order = await Orders.findById(orderId).populate("orderedItems.product");
        if (!order) {
            console.error(`Order not found for ID: ${orderId}`);
            return res.status(404).render('page-404', { message: "Order not found." });
        }
        console.log("orderId : ", orderId, "session : ", session, "order : ", order);
        res.render('users/dashboard/order folder/order_details', {
            order, session, activeTab: 'orders',search
        })
        console.log("Order details page loaded")
    } catch (error) {
        console.error(error)
        res.status(500).render('users/page-404', { message: "Unable to retrieve order details." });
    }
}

exports.getOrdersAdmin = async (req,res)=>{
    try {
        console.log("getOrdersAdmin called")
        const orderStatuses = Orders.schema.path('status').enumValues;
        const page = parseInt(req.query.page) || 1;
        const limit = 6;
        const skip = (page - 1) * limit;

        const returnRequests = await Orders.find({ 'returnDetails.returnStatus':'Requested'}).populate({
            path: 'orderedItems.product',
            select: 'name'
        }).populate('userId')

        const orders = await Orders.find({})
            .populate('userId', 'username email')
            .populate({
                path: 'orderedItems.product',
                model: 'Product',
                select: 'name image priceAtPurchase'
            })
            .sort({ createdAt: -1 }).skip(skip).limit(limit)
        const totalOrders = await Orders.countDocuments();
        const totalPages = Math.ceil(totalOrders / limit);

        res.render('admin/order folder/orders', {
            orders, activeTab: 'orders', orderStatuses, returnRequests,
            page,
            totalPages,
            limit,
            totalOrders
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
        console.log("orderId : ", orderId);

        // Fetch the order
        const order = await Orders.findById(orderId);
        console.log("order : ", order);
        
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        
        // Check if the order is eligible for cancellation
        if (["Cancelled", "Delivered", "Returned"].includes(order.status)) {
            return res.status(400).json({ message: "Order cannot be cancelled." });
        }

        const currentDate = new Date();

        // Update order status and product inventory
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

        // Restore product inventory
        for (const item of order.orderedItems) {
            await Products.findByIdAndUpdate(item.product, {
                $inc: { inventory: item.quantity }
            });
        }

        console.log("Order cancelled successfully");
        res.status(200).json({ 
            message: "Order cancelled successfully",
            cancelledOn: currentDate 
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
        console.log("orderId : "+orderId+"status : "+status)
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
                if(order.paymentMethod === "COD"){
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
        } catch(err) {
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

exports.returnOrder = async (req,res)=>{
    try {
        const orderId = req.params.orderId;
        const returnReason = req.body.returnReason;
        await Orders.findByIdAndUpdate(orderId, { 'returnDetails.returnRequested': true, 'returnDetails.returnReason': returnReason })
        res.status(200).json({ message: "Return request sent" })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message:"Server error" })
    }
}

exports.approveReturnRequest = async (req,res)=>{
    try {
        const orderId = req.params.orderId;
        const order = await Orders.findByIdAndUpdate(orderId, { 'returnDetails.returnStatus': 'Approved', status:'Returned' })
        await Wallets.findOneAndUpdate({ userId: order.userId},{ 
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
        res.status(500).json({ message:"Server error" })
    }
}

exports.rejectReturnRequest = async (req,res)=>{
    try {
        const orderId = req.params.orderId;
        await Orders.findByIdAndUpdate(orderId, { 'returnDetails.returnStatus': 'Rejected' })
        res.status(200).json({ message: "Return request rejected" })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message:"Server error" })
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
        doc.fontSize(10).text('Craftora', { align: 'center' });
        doc.fontSize(10).text('www.craftora.com', { align: 'center' });
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