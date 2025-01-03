const Wishlist = require('../models/wishlistSchema');

// Add product to wishlist
exports.addToWishlist = async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.session || !req.session.user || !req.session.user._id) {
            return res.status(401).json({ 
                success: false, 
                message: 'Please login to add items to wishlist'
            });
        }

        const userId = req.session.user._id;
        const productId = req.body.productId;
        
        if (!productId) {
            return res.status(400).json({
                success: false,
                message: 'Product ID is required'
            });
        }

        let wishlist = await Wishlist.findOne({ user: userId });

        if (!wishlist) {
            wishlist = new Wishlist({
                user: userId,
                products: [{ product: productId }]
            });
            await wishlist.save();
            return res.json({ 
                success: true, 
                message: 'Product added to wishlist',
                inWishlist: true
            });
        }

        const productExists = wishlist.products.some(item => 
            item.product.toString() === productId
        );

        if (!productExists) {
            wishlist.products.push({ product: productId });
            await wishlist.save();
            return res.json({ 
                success: true, 
                message: 'Product added to wishlist',
                inWishlist: true
            });
        } else {
            wishlist.products = wishlist.products.filter(item => 
                item.product.toString() !== productId
            );
            await wishlist.save();
            return res.json({ 
                success: true, 
                message: 'Product removed from wishlist',
                inWishlist: false
            });
        }
    } catch (error) {
        console.error('Error in addToWishlist:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Error updating wishlist',
            error: error.message 
        });
    }
};

// Check if product is in wishlist
exports.checkWishlist = async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.session || !req.session.user || !req.session.user._id) {
            return res.json({ 
                success: true, 
                inWishlist: false
            });
        }

        const userId = req.session.user._id;
        const productId = req.params.productId;

        const wishlist = await Wishlist.findOne({ user: userId });
        
        const inWishlist = wishlist ? 
            wishlist.products.some(item => item.product.toString() === productId) : 
            false;

        res.json({ 
            success: true, 
            inWishlist 
        });
    } catch (error) {
        console.error('Error in checkWishlist:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error checking wishlist status'
        });
    }
};

// Get wishlist
exports.getWishlist = async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.session || !req.session.user || !req.session.user._id) {
            return res.redirect('/user/login');
        }
        const search = req.query.search || '';
        const userId = req.session.user._id;
        const wishlist = await Wishlist.findOne({ user: userId })
            .populate({
                path: 'products.product',
                select: 'productName productImage mrp productOffer discountedPrice'
            });
            
        if (!wishlist) {
            return res.render('users/wishlist', { 
                wishlistItems: [],
                user: req.session.user,
                session: req.session,
                search
            });
        }
        
        res.render('users/wishlist', {
            wishlistItems: wishlist.products,
            user: req.session.user,
            session: req.session,
            search
        });
    } catch (error) {
        console.error('Error in getWishlist:', error);
        res.status(500).render('error', { 
            message: 'Error fetching wishlist',
            error: error.message,
            session: req.session
        });
    }
};

// Remove product from wishlist
exports.removeFromWishlist = async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.session || !req.session.user || !req.session.user._id) {
            return res.status(401).json({ 
                success: false, 
                message: 'Please login to remove items from wishlist'
            });
        }

        const userId = req.session.user._id;
        const productId = req.body.productId;

        const wishlist = await Wishlist.findOne({ user: userId });
        
        if (!wishlist) {
            return res.status(404).json({ 
                success: false, 
                message: 'Wishlist not found' 
            });
        }

        wishlist.products = wishlist.products.filter(
            item => item.product.toString() !== productId
        );

        await wishlist.save();
        res.json({ 
            success: true, 
            message: 'Product removed from wishlist' 
        });
    } catch (error) {
        console.error('Error removing from wishlist:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error removing from wishlist' 
        });
    }
};
