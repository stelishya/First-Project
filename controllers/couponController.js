const Coupon = require('../models/couponSchema');
const Orders = require('../models/orderSchema')
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
        if (error.code === 11000) { 
            res.status(400).json({ message: 'A coupon with this code already exists' });
        } else {
            res.status(500).json({ message: 'Error creating coupon', error: error.message });
        }
    }
};

exports.getAllCoupons = async (req,res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit;

        const totalCoupons = await Coupon.countDocuments({});
        
        const coupons = await Coupon.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalPages = Math.ceil(totalCoupons / limit);
        const startIndex = skip + 1;
        const endIndex = Math.min(skip + limit, totalCoupons);

        res.render('admin/coupon folder/coupons', {
            coupons,
            currentPage: page,
            totalPages,
            totalCoupons,
            startIndex,
            endIndex,
            limit,
            activeTab: 'coupons'
        });

    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.status(500).json({ message: 'Error fetching coupons', error: error.message });
    }
};
exports.editCoupon = async (req, res) => {
    try {
        console.log("editCoupon called ")
        const couponId = req.params.id;
        const { 
            name,
            code,
            offerPercentage,
            minimumPurchase,
            maximumDiscount,
            startDate,
            expiryDate,
            usageLimit}=req.body;
        console.log("req.body from edit product : ",req.body)
        if (!name || !code || !offerPercentage || !minimumPurchase || !startDate || !expiryDate) {
            return res.status(400).json({
                success: false,
                message: 'All required fields must be filled'
            });
        }
        const existingCoupon = await Coupon.findOne({
            code: code.toUpperCase(),
            _id: { $ne: couponId }
        });
        console.log('existingCoupon:',existingCoupon)
        if (existingCoupon) {
            return res.status(400).json({
                success: false,
                message: 'Coupon code already exists'
            });
        }
        // const updates = req.body;
        const updatedCoupon = await Coupon.findByIdAndUpdate(couponId, {
            name,
            code: code.toUpperCase(),
            offerPercentage,
            minimumPurchase,
            maximumDiscount: maximumDiscount || undefined,
            usageLimit: usageLimit || undefined,
            startDate: new Date(startDate),
            expiryDate: new Date(expiryDate)
        },{ new: true });

        if (!updatedCoupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found'
            });
        }
        console.log('updatedCoupon:',updatedCoupon);
        return res.status(200).json({success:true,message:'Coupon updated successfully',coupon:updatedCoupon});
        // res.redirect('/admin/coupons',{success:true,message:'Coupon updated successfully',coupon:updatedCoupon});
    } catch (error) {
        console.error('Error in editCoupon:', error);
        res.status(500).json({success:false,message:'Error updating coupon',error:error.message});
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

exports.getAvailableCoupons = async (req, res) => {
    try {
        const currentDate = new Date();
        const coupons = await Coupon.find({
            isActive: true,
            startDate: { $lte: currentDate },
            expiryDate: { $gt: currentDate } 
        }).select('name code offerPercentage minimumPurchase maximumDiscount startDate expiryDate')
        .sort({ expiryDate: 1 }); 
        
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

exports.applyCoupon = async (req, res) => {
    try {
        console.log("applyCoupon callled")
        const { code, cartTotal } = req.body;
        const userId = req.session.user._id;
        console.log("code,cartTotal: ",code,cartTotal)
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
        console.log("coupon: ",coupon)
        const coup= await Orders.findOne({userId},{couponCode:code});
        if(coup){
            return res.status(200).json({success:false,message:'Coupon already used'})
        }
        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Invalid or expired coupon' });
        }

        if (cartTotal < coupon.minimumPurchase) {
            return res.status(400).json({ 
                success: false,
                message: `Minimum purchase amount of ₹${coupon.minimumPurchase} required`
            });
        }

        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
            return res.status(400).json({ success: false, message: 'Coupon usage limit has been reached' });
        }

        // const alreadyUsed = coupon.usedBy.some(use => use.userId.equals(userId));
        // if (alreadyUsed) {
        //     return res.status(400).json({ message: 'You have already used this coupon' });
        // }

        let discount = (cartTotal * coupon.offerPercentage) / 100;
        
        if (coupon.maximumDiscount) {
            discount = Math.min(discount, coupon.maximumDiscount);
        }
        discount = Math.round(discount * 100) / 100;
        const totalAmount = Math.round((cartTotal - discount) * 100) / 100;

        // const finalAmount = Math.round((cartTotal - discount) * 100) / 100;
        // const totalAmount = Math.round((tod))

        await Coupon.findByIdAndUpdate(coupon._id, {
            $inc: { usedCount: 1 },
            $push: { usedBy: { userId } }
        });
        req.session.user.appliedCoupon=coupon._id;
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
        req.session.user.appliedCoupon=null;

        res.status(200).json({ success:true, message: 'Coupon removed successfully' ,originalAmount: Math.round(originalAmount)});
    } catch (error) {
        console.error('Error removing coupon:', error);
        res.status(500).json({success:false, message: 'Error removing coupon', error: error.message });
    }
};