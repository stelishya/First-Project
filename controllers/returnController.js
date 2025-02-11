const Products = require('../models/productSchema')
const Orders = require('../models/orderSchema');
const Wallets = require('../models/walletSchema');
const Users = require('../models/userSchema')

exports.getReturns = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        const returns = await Orders.find({
            'returnDetails.returnRequested': true,
            'returnDetails.returnStatus': 'Pending'
        }).populate('userId', 'username')
        .populate({
            path: 'orderedItems.product',
            select: 'productName productImage priceAtPurchase'
        })
        .select('orderedItems finalAmounttotalDiscount couponDiscount returnDetails')
        .skip(skip)
        .limit(limit)
        .sort({ 'returnDetails.returnRequestedAt': -1 });

        const totalReturns = await Orders.countDocuments({
            'returnDetails.returnRequested': true,
            'returnDetails.returnStatus': 'Pending'
        });

        const totalPages = Math.ceil(totalReturns / limit);
        const startIndex = totalReturns === 0 ? 0 : (page - 1) * limit + 1;
        const endIndex = Math.min(page * limit, totalReturns);

        res.render('admin/returns', { 
            returns,
            currentPage: page,
            totalPages,
            totalReturns,
            startIndex,
            endIndex,
            limit,
            activeTab: 'returns',
         });
    } catch (error) {
        console.error('Error fetching returns:', error);
        res.status(500).render('admin/admin-error', { message: 'Error fetching returns' });
    }
};

exports.getReturnDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Orders.findById(orderId)
            .populate('userId', 'username')
            .populate({
                path: 'orderedItems.product',
                select: 'productName productImage priceAtPurchase'
            });

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        res.json(order);
    } catch (error) {
        console.error('Error fetching return details:', error);
        res.status(500).json({ message: "Failed to fetch return details" });
    }
};

// approve return
exports.approveReturn = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Orders.findById(orderId)
            .populate({
                path: 'orderedItems.product',
                select: 'productName productImage priceAtPurchase'
            });

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        const totalOrderValue = order.orderedItems.reduce((total, item) => {
            return total + (item.priceAtPurchase * item.quantity);
        }, 0);

        const returnedItem = order.orderedItems[0]; 
        const itemTotalPrice = returnedItem.priceAtPurchase * returnedItem.quantity;
        const itemProportion = itemTotalPrice / totalOrderValue;

        const itemCouponDiscount = order.couponDiscount * itemProportion;

        const refundAmount = itemTotalPrice - itemCouponDiscount;

        console.log("totalOrderValue: ", totalOrderValue);
        console.log(`returnedItem: ${JSON.stringify(returnedItem)}`);
        console.log("itemTotalPrice: ", itemTotalPrice);
        console.log("itemProportion: ", itemProportion);
        console.log("itemCouponDiscount: ", itemCouponDiscount);
        console.log("refundAmount: ", refundAmount);

        if (!refundAmount || refundAmount <= 0) {
            return res.status(400).json({ message: "Invalid refund amount" });
        }

        // update product stock
        await Products.findByIdAndUpdate(
            returnedItem.product._id,
            { $inc: { stock: returnedItem.quantity } }
        );
        // update order status
        order.status = 'Returned';
        order.returnDetails.returnStatus = 'Approved';
        order.returnDetails.returnDate = new Date();
        await order.save();
        console.log("order saved")
        // if (order.paymentMethod !== 'COD') {
            // const wallet = await Wallets.findOneAndUpdate(
            //     { userId: order.userId },
            //     {
            //         $inc: { balance: refundAmount },
            //         $push: {
            //             transactions: {
            //                 type: 'credit',
            //                 amount: refundAmount,
            //                 description: `Refund for returned order #${order._id} (after coupon adjustment)`
            //             }
            //         }
            //     },
            //     { new: true }
            // );
            const userId = order.userId;
            const latestTransaction = await Wallets.findOne({ userId }).sort({ createdAt: -1 });
            const currentBalance = latestTransaction ? latestTransaction.balance : 0;
            const newBalance = currentBalance + refundAmount;
    
                const wallet = new Wallets({
                    userId,
                    orderId,
                    type: 'CREDIT',
                    amount: refundAmount,
                    description: `Refund for returned order #${order._id} `,
                    balance: newBalance
                });
                await wallet.save();
                await Users.findOneAndUpdate(
                    {_id:userId},
                    {$inc:{wallet:newBalance}}
                    
                )
                console.log("Refund processed successfully. New balance:", newBalance);
            // if (!wallet) {
            //     console.error('Wallet not found for user:', order.userId);
            //     return res.status(404).json({ message: "User wallet not found" });
            // }
        // }
        console.log('Wallet :', wallet);
        console.log('Stock updated for product:', returnedItem.product._id);
        console.log(`Return request approved successfully. Refund of ₹ ${refundAmount.toFixed(2)} has been processed.`)
        return res.status(200).json({ 
            message: `Return request approved successfully. Refund of ₹ ${refundAmount.toFixed(2)} has been processed.`
            // message: `Return request approved successfully. ${order.paymentMethod !== 'COD' ? 'Refund of ₹' + refundAmount.toFixed(2) + ' has been processed.' : ''}`
        });
    } catch (error) {
        console.error('Error approving return:', error);
        res.status(500).json({ message: "Failed to approve return request" });
    }
};

// reject return 
exports.rejectReturn = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Orders.findById(orderId);

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        // update return status
        order.returnDetails.returnStatus = 'Rejected';
        await order.save();

        return res.status(200).json({ message: "Return request has been rejected" });
    } catch (error) {
        console.error('Error rejecting return:', error);
        res.status(500).json({ message: "Failed to reject return request" });
    }
};
