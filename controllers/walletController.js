const Wallets = require('../models/walletSchema');
const User = require('../models/userSchema');
const crypto = require('crypto');
require('dotenv').config();

const getWalletBalance = async (req, res) => {
    try {
        const session = req.session.user;
        const userId = session._id;
        // let wallet = await Wallets.findOne({ userId: userId });
        // if (!wallet) {
        //     wallet = new Wallets({ userId: userId, transactions: [] });
        //     await wallet.save();
        // }
        // res.json({ success: true, balance: wallet.balance });
        const latestTransaction = await Wallets.findOne({ userId }).sort({ createdAt: -1 });
        const balance = latestTransaction ? latestTransaction.balance : 0;
        res.json({ success: true, balance });
    } catch (error) {
        console.error('Error getting wallet balance:', error);
        res.status(500).json({ success: false, message: 'Failed to get balance' }); 
    }
};

const walletPage = async (req,res)=>{
    try {
        const search = req.query.search || ''; 
        const session = req.session.user;
        const userId = session._id;
        // let wallet = await Wallets.findOne({ userId: userId });
        // if (!wallet) {
        //     wallet = new Wallets({ userId: userId, transactions: [] });
        //     await wallet.save();
        // }
        // res.render('users/dashboard/wallet', {
        //     userWallet: wallet, session,search, activeTab: 'wallet', razorpayKey: process.env.RAZORPAY_KEY_ID
        // } )
        const latestTransaction = await Wallets.findOne({ userId }).sort({ createdAt: -1 });
        const balance = latestTransaction ? latestTransaction.balance : 0;
        
        // Get recent transactions
        const transactions = await Wallets.find({ userId })
            .sort({ createdAt: -1 })
            .limit(10);
        
        res.render('users/dashboard/wallet', {
            userWallet: { balance },
            transactions,
            session,
            search,
            activeTab: 'wallet',
            razorpayKey: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to fetch wallet' });
    }
}

const addMoneyToWallet = async (req, res) => {
    try {
        const { 
            amount,
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature 
        } = req.body;
        console.log("req.body : ",{amount,
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature })
        const userId = req.session.user._id;

        if (!amount || amount <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid amount' 
            });
        }

        // Verify Razorpay signature
        if (razorpay_payment_id && razorpay_order_id && razorpay_signature) {
            const sign = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSign = crypto
                .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
                .update(sign.toString())
                .digest("hex");

            if (razorpay_signature !== expectedSign) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Invalid payment signature" 
                });
            }
        }

        // Get current balance
        const latestTransaction = await Wallets.findOne({ userId }).sort({ createdAt: -1 });
        const currentBalance = latestTransaction ? latestTransaction.balance : 0;
        const newBalance = currentBalance + Number(amount);
        console.log("latestTransaction : ", latestTransaction);
        console.log("currentBalance : ", currentBalance);
        console.log("newBalance : ", newBalance);
        // Create new wallet transaction
        const transaction = new Wallets({
            userId,
            type: 'CREDIT',
            amount: Number(amount),
            description: 'Added money to wallet via Razorpay',
            balance: newBalance,
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id
        });

        await transaction.save();
        console.log("transaction : ", transaction);

        console.log("Money added to wallet successfully");
        res.json({ 
            success: true, 
            newBalance,
            message: 'Money added successfully'
        });

    } catch (error) {
        console.error('Error adding money to wallet:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to add money to wallet' 
        });
    }
};

const loadWallet = async (req, res) => {
    try {
        const userId = req.session.user_id;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.redirect('/login');
        }

        res.render('users/dashboard/wallet', {
            user,
            search: '',
            activeTab: 'wallet'
        });
    } catch (error) {
        console.error('Error loading wallet:', error);
        res.status(500).render('users/error', { message: 'Error loading wallet' });
    }
};

const addToWallet = async (req, res) => {
    try {
        const userId = req.session.user_id;
        const { amount } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Add the amount to wallet
        user.wallet = (user.wallet || 0) + Number(amount);
        await user.save();

        res.json({
            success: true,
            message: 'Amount added successfully',
            newBalance: user.wallet
        });
    } catch (error) {
        console.error('Error adding to wallet:', error);
        res.status(500).json({ success: false, message: 'Error adding amount to wallet' });
    }
};

module.exports = {
    addMoneyToWallet,
    walletPage,
    getWalletBalance,
    loadWallet,
    addToWallet
}