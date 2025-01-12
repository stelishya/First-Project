const Coupon = require('../models/couponSchema');

// Admin Controllers
exports.createCoupon = async (req, res) => {
    try {
        const {
            code,
            name,
            offerPercentage,
            minimumPurchase,
            maximumDiscount,
            startDate,
            expiryDate,
            usageLimit
        } = req.body;

        // Validate offer percentage is between 0 and 100
        if (offerPercentage < 0 || offerPercentage > 100) {
            return res.status(400).json({ message: 'Offer percentage must be between 0 and 100' });
        }

        const coupon = new Coupon({
            code: code.toUpperCase(),
            name,
            offerPercentage,
            minimumPurchase,
            maximumDiscount,
            startDate,
            expiryDate,
            usageLimit
        });

        await coupon.save();
        res.status(201).json({ message: 'Coupon created successfully', coupon });
    } catch (error) {
        if (error.code === 11000) { // Duplicate key error
            res.status(400).json({ message: 'A coupon with this code already exists' });
        } else {
            res.status(500).json({ message: 'Error creating coupon', error: error.message });
        }
    }
};

exports.getAllCoupons = async (req,res) => {
    try {
        const coupons = await Coupon.find({}).sort({ createdAt: -1 });
        res.render('admin/coupon folder/coupons', { coupons });

    } catch (error) {
        res.status(500).json({ message: 'Error fetching coupons', error: error.message });
    }
};
exports.editCoupon = async (req, res) => {
    try {
        const couponId = req.params.id;
        const updates = req.body;
        await Coupon.findByIdAndUpdate(couponId, updates);
        res.redirect('/admin/coupons');
    } catch (error) {
        console.error('Error updating coupon:', error);
        res.status(500).send('Error updating coupon');
    }
};

exports.deleteCoupon = async (req, res) => {
    try {
        const couponId = req.params.id;
        const deletedCoupon = await Coupon.findByIdAndDelete(couponId);
        
        if (!deletedCoupon) {
            return res.status(404).json({ message: 'Coupon not found' });
        }
        
        res.json({ success: true, message: 'Coupon deleted successfully' });
    } catch (error) {
        console.error('Error deleting coupon:', error);
        res.status(500).json({ message: 'Error deleting coupon', error: error.message });
    }
};

exports.couponStatus = async (req, res) => {
    try {
        const couponId = req.params.id;
        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            return res.status(404).json({ message: 'Coupon not found' });
        }
        
        coupon.isActive = !coupon.isActive;
        await coupon.save();
        
        res.status(200).json({ message: 'Coupon status updated successfully', coupon });
    } catch (error) {
        res.status(500).json({ message: 'Error updating coupon status', error: error.message });
    }
}

// Get available coupons for users
exports.getAvailableCoupons = async (req, res) => {
    try {
        const currentDate = new Date();
        const coupons = await Coupon.find({
            isActive: true,
            startDate: { $lte: currentDate },
            expiryDate: { $gt: currentDate } // Use $gt to exclude coupons that expire today
        }).select('name code offerPercentage minimumPurchase maximumDiscount startDate expiryDate')
        .sort({ expiryDate: 1 }); // Sort by expiry date, showing soonest expiring first
        
        // Format dates and add expiry status
        const formattedCoupons = coupons.map(coupon => {
            const expiryDate = new Date(coupon.expiryDate);
            const daysLeft = Math.ceil((expiryDate - currentDate) / (1000 * 60 * 60 * 24));
            
            return {
                ...coupon.toObject(),
                daysLeft,
                expiryText: daysLeft === 1 ? 'Expires today' : 
                           daysLeft < 7 ? `Expires in ${daysLeft} days` :
                           `Expires on ${expiryDate.toLocaleDateString()}`
            };
        });
        
        res.json(formattedCoupons);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching coupons', error: error.message });
    }
};

// User Controllers
exports.applyCoupon = async (req, res) => {
    try {
        const { code, cartTotal } = req.body;
        const userId = req.session.user._id;

        if (!code || !cartTotal) {
            return res.status(400).json({ 
                success: false,
                message: 'Coupon code and cart total are required' 
            });
        }
        const coupon = await Coupon.findOne({ 
            code: code.toUpperCase(),
            isActive: true,
            startDate: { $lte: new Date() },
            expiryDate: { $gte: new Date() }
        });

        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Invalid or expired coupon' });
        }

        // Check minimum purchase
        if (cartTotal < coupon.minimumPurchase) {
            return res.status(400).json({ 
                success: false,
                message: `Minimum purchase amount of ₹${coupon.minimumPurchase} required`
            });
        }

        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
            return res.status(400).json({ success: false, message: 'Coupon usage limit has been reached' });
        }

        // Check if user already used this coupon
        // const alreadyUsed = coupon.usedBy.some(use => use.userId.equals(userId));
        // if (alreadyUsed) {
        //     return res.status(400).json({ message: 'You have already used this coupon' });
        // }

        // Calculate percentage discount
        let discount = (cartTotal * coupon.offerPercentage) / 100;
        
        // Apply maximum discount cap if set
        if (coupon.maximumDiscount) {
            discount = Math.min(discount, coupon.maximumDiscount);
        }
        discount = Math.round(discount * 100) / 100;
        const totalAmount = Math.round((cartTotal - discount) * 100) / 100;

        // const finalAmount = Math.round((cartTotal - discount) * 100) / 100;
        // const totalAmount = Math.round((tod))

        // Update coupon usage
        await Coupon.findByIdAndUpdate(coupon._id, {
            $inc: { usedCount: 1 },
            $push: { usedBy: { userId } }
        });

        res.status(200).json({
            success: true,
            message: 'Coupon applied successfully',
            couponDetails: {
                code: coupon.code,
                name: coupon.name,
                offerPercentage: coupon.offerPercentage
            },
            discount,
            totalAmount
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error applying coupon', error: error.message });
    }
};

exports.removeCoupon = async (req, res) => {
    try {
        const { code ,currentTotal} = req.body;
        const userId = req.session.user._id;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Coupon code is required'
            });
        }
        const coupon = await Coupon.findOne({ code: code.toUpperCase() });
        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found'
            });
        }
        // Calculate the original amount by reversing the discount
        const discountPercentage = coupon.offerPercentage;
        const discountAmount = (currentTotal * discountPercentage) / (100 - discountPercentage);
        const originalAmount = currentTotal + discountAmount;

        await Coupon.findOneAndUpdate(
            { code: code.toUpperCase() },
            { 
                $pull: { usedBy: { userId } },
                $inc: { usedCount: -1 }
            }
        );

        res.status(200).json({ success:true, message: 'Coupon removed successfully' ,originalAmount: Math.round(originalAmount)});
    } catch (error) {
        console.error('Error removing coupon:', error);
        res.status(500).json({success:false, message: 'Error removing coupon', error: error.message });
    }
};