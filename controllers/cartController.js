const Carts = require('../models/cartSchema')
const Products = require('../models/productSchema')
const { calculateProductPrices, calculateOrderItemPrices } = require('../helpers/priceCalculator');


exports.getCart = async (req, res) => {
    const search = req.query.search || '';
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        }
        const userId = req.session.user._id;

        const page = parseInt(req.query.page) || 1;
        const limit = 6;
        const skip = (page - 1) * limit;

        const cart = await Carts.findOne({ userId }).populate({
            path: 'items.productId',
            model: 'Product',
            select: 'productName description productImage mrp productOffer maxDiscount  category stock',
            populate: {
                path: 'category',
                select: 'name categoryOffer '
            }
        });

        if (!cart || !cart.items || cart.items.length === 0) {
            return res.render('users/cart/cart', {
                session: req.session.user,
                countOfProducts: 0,
                products: [],
                totalAmount: 0,
                search,
                currentPage: 1,
                totalPages: 1,
                totalItems: 0
            });
        }

        const totalItems = cart.items.length;
        const totalPages = Math.ceil(totalItems / limit);

        const paginatedCart = await Carts.findOne({ userId })
            .populate({
                path: 'items.productId',
                model: 'Product',
                select: 'productName description productImage mrp productOffer maxDiscount category stock',
                populate: {
                    path: 'category',
                    select: 'name categoryOffer'
                }
            })
            .slice('items', [skip, limit]);

        let totalAmount = 0;
        let totalDiscount = 0;
        let subtotal = 0;

        const products = paginatedCart.items.map(item => {
            const product = item.productId;
            if (!product) return null;

            const itemPrices = calculateOrderItemPrices({
                product: product,
                quantity: item.quantity
            });

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
                discountedPrice: itemPrices.pricePerUnit,
                totalDiscount: itemPrices.totalDiscount,
                bestDiscountType: `${itemPrices.discountPercentage.toFixed(0)} Discount`,
                finalAmount: itemPrices.totalPrice,
                stock: product.stock
            };
        }).filter(Boolean);

        const countOfProducts = totalItems;
        console.log("Hi i'm rendering cart page");
        console.log(`products: ${products}`);
        console.log('Cart Totals:');
        console.log(`mrp: ${products[0]?.mrp || 0}`);
        console.log(`Subtotal: ${subtotal}`);
        console.log(`Total Discount: ${totalDiscount}`);
        console.log(`Final Amount: ${totalAmount}`);

        res.render('users/cart/cart', {
            session: req.session.user,
            products,
            mrp: products.mrp,
            countOfProducts,
            totalAmount: totalAmount.toFixed(0),
            subtotal: subtotal.toFixed(0),
            totalDiscount: totalDiscount.toFixed(0),
            search,
            currentPage: page,
            totalPages,
            totalItems,
            limit
        });

    } catch (error) {
        console.error('Error in getCart:', error);
        res.status(500).send('Error loading cart. Please try again.');
    }
}

exports.addToCart = async (req, res) => {
    try {
        console.log("addToCart called")
        if (!req.session.user || !req.session.user._id) {
            return res.status(401).json({
                success: false,
                message: "Please login to add items to cart"
            });
        }

        const userId = req.session.user._id;
        const productId = req.body.productId;
        const quantity = parseInt(req.body.quantity) || 1;
        console.log("\nuserId : " + userId + "\nproductId : " + productId + "\nquantity : " + quantity)

        const product = await Products.findById(productId);
        console.log("product: ", product)
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        const maxAllowedQuantity = Math.min(product.stock, 5);
        console.log("maxAllowedQuantity : ", maxAllowedQuantity)
        if (quantity > maxAllowedQuantity) {
            return res.status(400).json({
                success: false,
                message: maxAllowedQuantity === 5
                    ? "Maximum limit of 5 items per product"
                    : `Only ${maxAllowedQuantity} items available in stock`
            });
        }

        const calculatedPrices = calculateProductPrices(product);
        const price = calculatedPrices.finalAmount;
        // const price = product.discountedPrice || product.mrp;
        const totalPrice = price * quantity;
        console.log("price,totalPrice : ", price, totalPrice)
        let cart = await Carts.findOne({ userId }).populate('items.productId', 'price totalPrice');
        console.log("cart : ", cart)
        if (!cart) {
            console.log("cart not found")
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
            console.log("cart found")
            const existingItem = cart.items.find((item) => {
                // (item) => item.productId.toString() === productId
                const productIdString = item.productId._id.toString();
                console.log("Current item productId:", productIdString);
                return productIdString === productId;
            });
            console.log("existingItem : ", existingItem);
            console.log("cart.items : ", cart.items);

            if (existingItem) {
                const newTotalQuantity = existingItem.quantity + quantity;
                console.log("newTotalQuantity : ", newTotalQuantity)
                if (newTotalQuantity > maxAllowedQuantity) {
                    return res.status(400).json({
                        success: false,
                        message: maxAllowedQuantity === 5
                            ? "Maximum limit of 5 items per product"
                            : `Only ${maxAllowedQuantity} items available in stock`
                    });
                }

                existingItem.quantity = newTotalQuantity;
                existingItem.totalPrice = price * newTotalQuantity;

                await cart.save();

                return res.status(200).json({
                    success: true,
                    message: "Product quantity updated in cart"
                });
            } else {
                cart.items.push({
                    productId,
                    quantity,
                    price,
                    totalPrice,
                    status: 'placed'
                });
            }
        }
        console.log("cart before saving: ", cart)
        await cart.save();

        res.status(200).json({
            success: true,
            message: "Product added to cart successfully!"
        });

    } catch (error) {
        console.log('Error adding to cart:', error);
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
            if (!product) return res.status(404).json({ success: false, message: "Product not found" });
            const newQuantity = cart.items[productIndex].quantity + change;

            if (change > 0) {
                const currentProduct = await Products.findById(productId);
                if (!currentProduct) {
                    return res.status(404).json({ success: false, message: 'Product not found' });
                }

                const maxAllowedQuantity = Math.min(currentProduct.quantity, 5);
                if (newQuantity > maxAllowedQuantity) {
                    return res.status(400).json({
                        success: false,
                        message: `Cannot add more items. ${maxAllowedQuantity === 5 ? 'Maximum limit is 5' : 'Not enough stock available'}`
                    });
                }
            }

            cart.items[productIndex].quantity = newQuantity < 1 ? 1 : newQuantity;

            const itemPrices = calculateOrderItemPrices({
                product: product,
                quantity: newQuantity
            });

            cart.items[productIndex].totalPrice = itemPrices.totalPrice;

            let totalAmount = 0;
            let totalDiscount = 0;
            let subtotal = 0;

            cart.items.forEach(item => {
                const prices = calculateOrderItemPrices({
                    product: item.productId,
                    quantity: item.quantity
                });
                
                totalAmount += prices.totalPrice;
                totalDiscount += prices.totalDiscount;
                subtotal += prices.originalPrice * item.quantity;
            });

            // const price = product.discountedPrice || product.mrp;
            // cart.items[productIndex].totalPrice = price * cart.items[productIndex].quantity;
            console.log("totalAmount in updateQuantity : ", totalAmount)

            await cart.save();
            return res.json({
                success: true,
                items: cart.items,
                totalAmount: totalAmount,
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

            const totalAmount = items.reduce((sum, item) => sum + (item.discountedPrice * item.quantity), 0);

            updatedCart.totalAmount = totalAmount;
            await updatedCart.save();

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