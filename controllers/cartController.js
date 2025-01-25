const Carts = require('../models/cartSchema')
const Products = require('../models/productSchema')
const { calculateOrderItemPrices } = require('../helpers/priceCalculator');

exports.getCart = async (req,res)=>{
    const search = req.query.search || ''; 
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        }
        const userId = req.session.user._id;

        const cart = await Carts.findOne({ userId }).populate({
            path: 'items.productId',
            model: 'Product',
            select: 'productName description productImage mrp productOffer maxDiscount  category stock',
            populate: { 
                path: 'category',
                select: 'name categoryOffer '
            }
        });

        if(!cart || !cart.items || cart.items.length === 0){
            return res.render('users/cart/cart', {
                session: req.session.user,
                countOfProducts: 0,
                products: [],
                totalAmount: 0,
                search
            });
        }

        let totalAmount = 0;
        let totalDiscount = 0;
        let subtotal = 0;

        const products = cart.items.map(item => {
            const product = item.productId;
            if (!product) return null;

            const itemPrices = calculateOrderItemPrices({
                product: product,
                quantity: item.quantity
            });
            // mrp
            totalAmount += itemPrices.totalPrice;
            totalDiscount += itemPrices.totalDiscount;
            subtotal += itemPrices.originalPrice * item.quantity;

            console.log(`Product: ${product.productName}`);
            console.log(`Original Price: ${itemPrices.originalPrice}`);
            console.log(`Discount: ${itemPrices.totalDiscount}`);
            console.log(`Final Price: ${itemPrices.totalPrice}`);
            console.log(`Product Stock: ${product.stock}`);

            return {
                ...item.toObject(),
                mrp: itemPrices.originalPrice,
                discountedPrice:itemPrices.pricePerUnit,
                totalDiscount: itemPrices.totalDiscount,
                bestDiscountType: `${itemPrices.discountPercentage} Discount`,
                finalAmount: itemPrices.totalPrice,
                stock: product.stock 
            };
        }).filter(Boolean); // Remove any null items
        
        const countOfProducts = products.length;
        console.log("Hi i'm rendering cart page")
        console.log(`products: ${products}`)
        console.log('Cart Totals:');
        // console.log(`mrp: ${products.mrp}`)
        console.log(`mrp: ${products[0]?.mrp || 0}`)
        console.log(`Subtotal: ${subtotal}`);
        console.log(`Total Discount: ${totalDiscount}`);
        console.log(`Final Amount: ${totalAmount}`);
        res.render('users/cart/cart', {
            session: req.session.user,
            products,
            mrp:products.mrp,
            countOfProducts,
            totalAmount: totalAmount.toFixed(2),
            subtotal: subtotal.toFixed(2),
            totalDiscount: totalDiscount.toFixed(2),
            search
        });
        
    } catch (error) {
        console.error('Error in getCart:', error);
        res.status(500).send('Error loading cart. Please try again.');
    }
}

exports.addToCart = async (req,res)=>{
    try {
        if (!req.session.user || !req.session.user._id) {
            return res.status(401).json({ 
                success: false, 
                message: "Please login to add items to cart" 
            });
        }

        const userId = req.session.user._id;
        const productId = req.body.productId;
        const quantity = parseInt(req.body.quantity) || 1;
        console.log("\nuserId : "+userId+"\nproductId : "+productId+"\nquantity : "+quantity)
        // Get product details
        const product = await Products.findById(productId);
        console.log(product)
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // Check inventory and max quantity
        const maxAllowedQuantity = Math.min(product.stock, 5);
        if (quantity > maxAllowedQuantity) {
            return res.status(400).json({
                success: false,
                message: maxAllowedQuantity === 5 
                    ? "Maximum limit of 5 items per product"
                    : `Only ${maxAllowedQuantity} items available in stock`
            });
        }

        // Calculate price
        const price = product.discountedPrice || product.mrp;
        const totalPrice = price * quantity;

        // Find or create cart
        let cart = await Carts.findOne({ userId });
        if (!cart) {
            cart = new Carts({
                userId,
                items: [{
                    productId,
                    quantity,
                    price,
                    totalPrice,
                    status: 'placed'
                }]
            });
        } else {
            // Check if product already exists in cart
            const existingItem = cart.items.find(
                item => item.productId.toString() === productId
            );

            if (existingItem) {
                // Check total quantity
                const newTotalQuantity = existingItem.quantity + quantity;
                if (newTotalQuantity > maxAllowedQuantity) {
                    return res.status(400).json({
                        success: false,
                        message: maxAllowedQuantity === 5 
                            ? "Maximum limit of 5 items per product"
                            : `Only ${maxAllowedQuantity} items available in stock`
                    });
                }

                // Update existing item
                existingItem.quantity = newTotalQuantity;
                existingItem.totalPrice = price * newTotalQuantity;
            } else {
                // Add new item
                cart.items.push({
                    productId,
                    quantity,
                    price,
                    totalPrice,
                    status: 'placed'
                });
            }
        }

        await cart.save();

        res.status(200).json({
            success: true,
            message: "Product added to cart successfully!"
        });

    } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(500).json({
            success: false,
            message: "Error adding product to cart. Please try again."
        });
    }
};

exports.updateQuantity = async (req, res) => {
    const { productId, change } = req.body;
    const userId = req.session.user._id;

    try {
        const cart = await Carts.findOne({ userId }).populate({
            path: 'items.productId',
            populate: { path: 'category' }
        });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        const productIndex = cart.items.findIndex(item => item.productId._id.toString() === productId);
        if (productIndex > -1) {
            const product = cart.items[productIndex].productId;
            const newQuantity = cart.items[productIndex].quantity + change;

            // Check if trying to increase quantity
            if (change > 0) {
                // Get latest product stock
                const currentProduct = await Products.findById(productId);
                if (!currentProduct) {
                    return res.status(404).json({ success: false, message: 'Product not found' });
                }

                // Check if new quantity exceeds stock or max limit
                const maxAllowedQuantity = Math.min(currentProduct.quantity, 5);
                if (newQuantity > maxAllowedQuantity) {
                    return res.status(400).json({ 
                        success: false, 
                        message: `Cannot add more items. ${maxAllowedQuantity === 5 ? 'Maximum limit is 5' : 'Not enough stock available'}`
                    });
                }
            }

            // Update quantity if all checks pass
            cart.items[productIndex].quantity = newQuantity < 1 ? 1 : newQuantity;

            // Recalculate total price for the updated item
            const price = product.discountedPrice || product.mrp;
            cart.items[productIndex].totalPrice = price * cart.items[productIndex].quantity;

            // Save the updated cart
            await cart.save();
            return res.json({
                success: true,
                items: cart.items,
                totalAmount: cart.totalAmount,
                message: 'Quantity updated successfully'
            });
        } else {
            return res.status(404).json({ success: false, message: 'Product not found in cart' });
        }
    } catch (error) {
        console.error('Error updating cart quantity:', error);
        res.status(500).json({ success: false, message: 'Error updating quantity' });
    }
};

exports.removeProduct = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const productId = req.body.productId;
        const updatedCart = await Carts.findOneAndUpdate(
            { userId },
            { $pull: { items: { productId } } },
            { new: true }
        ).populate({
            path: 'items.productId',
            populate: { path: 'category', select: 'offer' }
        });
        if (updatedCart) {
            // Calculate new totals after product removal
            const items = updatedCart.items.map(item => {
                const product = item.productId;
                const percentageDiscountFromProduct = product.offer ? Math.floor(product.mrp * (product.offer / 100)) : 0;
                const fixedDiscountFromProduct = product.fixedAmount || 0;
                const categoryDiscount = product.category.offer ? Math.floor(product.mrp * (product.category.offer / 100)) : 0;

                let discountedPrice = product.mrp;
                let bestDiscountType = '';

                if (percentageDiscountFromProduct > fixedDiscountFromProduct && percentageDiscountFromProduct > categoryDiscount) {
                    discountedPrice = product.mrp - percentageDiscountFromProduct;
                    bestDiscountType = `${product.offer}% off`;
                } else if (fixedDiscountFromProduct > categoryDiscount) {
                    discountedPrice = product.mrp - fixedDiscountFromProduct;
                    bestDiscountType = `₹${fixedDiscountFromProduct} off`;
                } else if (categoryDiscount > 0) {
                    discountedPrice = product.mrp - categoryDiscount;
                    bestDiscountType = `Category Offer: ${product.category.offer}% off`;
                }

                return {
                    ...item.toObject(),
                    discountedPrice,
                    bestDiscountType
                };
            });

            // Calculate new total amount
            const totalAmount = items.reduce((sum, item) => sum + (item.discountedPrice * item.quantity), 0);

            // Update the cart with new total
            updatedCart.totalAmount = totalAmount;
            await updatedCart.save();

            // Send response with updated data
            res.status(200).json({
                success: true,
                message: 'Product removed from cart',
                totalAmount,
                items: items.map(p => ({
                    quantity: p.quantity,
                    productId: {
                        name: p.productId.name
                    }
                }))
            });
        } else {
            res.status(404).json({ success: false, message: 'Cart not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error removing product from cart' });
    }
};