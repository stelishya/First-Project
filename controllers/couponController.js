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

exports.getAllCoupons = async () => {
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

// User Controllers
exports.applyCoupon = async (req, res) => {
    try {
        const { code, cartTotal } = req.body;
        const userId = req.session.user._id;

        const coupon = await Coupon.findOne({ 
            code: code.toUpperCase(),
            isActive: true,
            startDate: { $lte: new Date() },
            expiryDate: { $gte: new Date() }
        });

        if (!coupon) {
            return res.status(404).json({ message: 'Invalid or expired coupon' });
        }

        // Check minimum purchase
        if (cartTotal < coupon.minimumPurchase) {
            return res.status(400).json({ 
                message: `Minimum purchase amount of ₹${coupon.minimumPurchase} required`
            });
        }

        // Check if user already used this coupon
        const alreadyUsed = coupon.usedBy.some(use => use.userId.equals(userId));
        if (alreadyUsed) {
            return res.status(400).json({ message: 'You have already used this coupon' });
        }

        // Calculate percentage discount
        let discount = (cartTotal * coupon.offerPercentage) / 100;
        
        // Apply maximum discount cap if set
        if (coupon.maximumDiscount) {
            discount = Math.min(discount, coupon.maximumDiscount);
        }

        // Update coupon usage
        await Coupon.findByIdAndUpdate(coupon._id, {
            $inc: { usedCount: 1 },
            $push: { usedBy: { userId } }
        });

        res.status(200).json({
            message: 'Coupon applied successfully',
            discount,
            finalAmount: cartTotal - discount
        });
    } catch (error) {
        res.status(500).json({ message: 'Error applying coupon', error: error.message });
    }
};

exports.removeCoupon = async (req, res) => {
    try {
        const { code } = req.body;
        const userId = req.session.user._id;

        await Coupon.findOneAndUpdate(
            { code: code.toUpperCase() },
            { 
                $pull: { usedBy: { userId } },
                $inc: { usedCount: -1 }
            }
        );

        res.status(200).json({ message: 'Coupon removed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error removing coupon', error: error.message });
    }
};