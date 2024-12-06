const Products = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require('../../models/userSchema');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const sharp = require('sharp');

// Ensure product images directory exists
const productImagesDir = path.join(__dirname, '../../public/uploads/product-images');
if (!fsSync.existsSync(productImagesDir)) {
    fsSync.mkdirSync(productImagesDir, { recursive: true });
}

exports.products = async (req, res) => {
    try {
        const products = await Products.find().populate('category');
        const errorMessage = req.session.errorMessage;
        const successMessage = req.session.successMessage;
        
        req.session.errorMessage = null;
        req.session.successMessage = null;
        totalPages=0;

        res.render('admin/product-list', {
            products,
            errorMessage,
            successMessage,
            activeTab: "products",
            totalPages:0
        });
    } catch (error) {
        console.error('Error in products:', error);
        req.session.errorMessage = 'Error loading products';
        res.redirect('/admin/dashboard');
    }
};

exports.addProductPage = async (req, res) => {
    try {
        const categories = await Category.find({}, { name: 1 });
        const errorMessage = req.session.errorMessage;
        const successMessage = req.session.successMessage;
        
        req.session.errorMessage = null;
        req.session.successMessage = null;

        res.render('admin/product-add', {
            categories,
            errorMessage,
            successMessage,
            activeTab: "products"
        });
    } catch (error) {
        console.error('Error in addProductPage:', error);
        req.session.errorMessage = 'Error loading add product page';
        res.redirect('/admin/products');
    }
};

exports.addProduct = async (req, res) => {
    try {
        const {
            productName,
            description,
            mrp,
            quantity,
            productOffer,
            category,
            images
        } = req.body;

        // Process and save images
        const imageFilenames = [];
        if (images && Array.isArray(images)) {
            for (let [index, base64Image] of images.entries()) {
                const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
                const imageBuffer = Buffer.from(base64Data, 'base64');

                // Process image with Sharp
                const processedImageBuffer = await sharp(imageBuffer)
                    .resize(800, 800, {
                        fit: 'contain',
                        background: { r: 255, g: 255, b: 255, alpha: 1 }
                    })
                    .webp({ quality: 80 })
                    .toBuffer();

                // Generate unique filename
                const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '').split('.')[0];
                const filename = `product_image-${timestamp}-${index}.webp`;

                // Save the processed image
                await fs.writeFile(
                    path.join(__dirname, '../../public/uploads/product-images', filename),
                    processedImageBuffer
                );

                imageFilenames.push(filename);
            }
        }

        // Create new product
        const product = new Products({
            productName,
            description,
            mrp,
            quantity,
            productOffer: productOffer || 0,
            category,
            productImage: imageFilenames,
            isListed: true
        });

        await product.save();

        req.session.successMessage = 'Product added successfully';
        res.redirect('/admin/products');
    } catch (error) {
        console.error('Error in addProduct:', error);
        req.session.errorMessage = 'Error adding product';
        res.redirect('/admin/products/add');
    }
};

exports.editPage = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Products.findById(productId).populate('category');
        
        if (!product) {
            req.session.errorMessage = 'Product not found';
            return res.redirect('/admin/products');
        }

        const categories = await Category.find({}, { name: 1 });
        const errorMessage = req.session.errorMessage;
        const successMessage = req.session.successMessage;
        
        req.session.errorMessage = null;
        req.session.successMessage = null;

        res.render('admin/product-edit', {
            product,
            categories,
            errorMessage,
            successMessage,
            activeTab: "products"
        });
    } catch (error) {
        console.error('Error in editPage:', error);
        req.session.errorMessage = 'Error loading product edit page';
        res.redirect('/admin/products');
    }
};

exports.editProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const {
            productName,
            description,
            mrp,
            quantity,
            productOffer,
            category,
            removedImages,
            images
        } = req.body;

        // Get the product
        const product = await Products.findById(productId);
        if (!product) {
            req.session.errorMessage = 'Product not found';
            return res.redirect('/admin/products');
        }

        // Handle removed images
        if (removedImages) {
            const imagesToRemove = JSON.parse(removedImages);
            for (const img of imagesToRemove) {
                const index = product.productImage.indexOf(img);
                if (index > -1) {
                    product.productImage.splice(index, 1);
                    
                    // Delete the file
                    const imagePath = path.join(__dirname, '../../public/uploads/product-images', img);
                    try {
                        await fs.unlink(imagePath);
                    } catch (err) {
                        console.error(`Error deleting image ${img}:`, err);
                    }
                }
            }
        }

        // Handle new images
        if (images && Array.isArray(images)) {
            for (let [index, base64Image] of images.entries()) {
                const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
                const imageBuffer = Buffer.from(base64Data, 'base64');

                // Process image with Sharp
                const processedImageBuffer = await sharp(imageBuffer)
                    .resize(800, 800, {
                        fit: 'contain',
                        background: { r: 255, g: 255, b: 255, alpha: 1 }
                    })
                    .webp({ quality: 80 })
                    .toBuffer();

                // Generate unique filename
                const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '').split('.')[0];
                const filename = `product_image-${timestamp}-${index}.webp`;

                // Save the processed image
                await fs.writeFile(
                    path.join(__dirname, '../../public/uploads/product-images', filename),
                    processedImageBuffer
                );

                product.productImage.push(filename);
            }
        }

        // Update other fields
        product.productName = productName;
        product.description = description;
        product.mrp = mrp;
        product.quantity = quantity;
        product.productOffer = productOffer || 0;
        product.category = category;

        // Save the updated product
        await product.save();

        req.session.successMessage = 'Product updated successfully';
        res.redirect('/admin/products');
    } catch (error) {
        console.error('Error in editProduct:', error);
        req.session.errorMessage = 'Error updating product';
        res.redirect(`/admin/products/edit/${req.params.id}`);
    }
};

exports.list_unlist = async (req, res) => {
    try {
        const productId = req.params.id;
        const action = req.params.action;

        if (!['list', 'unlist'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action' });
        }

        const product = await Products.findById(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        product.isListed = action === 'list';
        await product.save();

        res.json({ success: true, message: `Product ${action}ed successfully` });
    } catch (error) {
        console.error('Error in list_unlist:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.productDetails = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Products.findById(productId).populate('category');
        
        if (!product) {
            req.session.errorMessage = 'Product not found';
            return res.redirect('/admin/products');
        }

        res.render('admin/product-view', {
            product,
            activeTab: "products"
        });
    } catch (error) {
        console.error('Error in productDetails:', error);
        req.session.errorMessage = 'Error loading product details';
        res.redirect('/admin/products');
    }
};

exports.deleteProduct = async (req, res) => {
    const catId = req.query.id
    try {
        const result = await Products.findByIdAndDelete(catId);
        if (result) {
            req.session.successMessage = "Product deleted succesfully"
            res.redirect('/admin/products')
        } else {
            req.session.errorMessage = "Couldn't delete the product"
            res.redirect('/admin/products')
        }
    } catch (err) {
        console.error(err);
        req.session.errorMessage = "Couldn't delete the product"
        res.redirect('/admin/products')
    }
};

exports.productDetailsUser = async (req, res) => {
    try {
        const productId = req.params.productId;
        const deliveryDate = new Date(new Date().setDate(new Date().getDate() + 5))
            .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

        const productDetails = await Products.findById(productId).populate('category', 'name offer');
        
        // Calculate the best offer
        const percentageDiscount = productDetails.offer ? Math.floor(productDetails.mrp * (productDetails.offer / 100)) : 0;
        const fixedDiscount = productDetails.fixedAmount || 0;
        const categoryOfferDiscount = productDetails.category.offer 
            ? Math.floor(productDetails.mrp * (productDetails.category.offer / 100)) 
            : 0;

        const bestDiscount = Math.max(percentageDiscount, fixedDiscount, categoryOfferDiscount);
        const discountedPrice = productDetails.mrp - bestDiscount;

        // Add calculated data to product object
        productDetails.discountedPrice = discountedPrice;
        productDetails.bestDiscount = bestDiscount;

        const relatedProducts = await Products.find({
            category: productDetails.category._id,
            _id: { $ne: productId }
        }).sort({ createdAt: -1 }).limit(10);

        const title = productDetails.name;
        const session = req.session.user || null;

        res.render('users/product folder/product', {
            title, session, product: productDetails, deliveryDate, relatedProducts
        });
    } catch (error) {
        console.error(error);
    }
};

// Product page
exports.showProductsPage = (req, res) => {
    const session = req.session.user || {}; // Check if a user is logged in
    const title = "All Products";

    res.render('users/product folder/products', {
        title,
        session: session ? session.username || session.fullname : null, // Use null if session or username is undefined
    });
};

// Dynamic product update
exports.fetchProducts = async (req, res) => {
    try {
        const sortOption = req.query.sortBy || 'new';
        let sortCriteria;
        switch (sortOption) {
            case 'popularity':
                break;
            case 'price-low-high':
                sortCriteria = { sellingPrice: 1 };
                break;
            case 'price-high-low':
                sortCriteria = { sellingPrice: -1 };
                break;
            case 'ratings':
                sortCriteria = { rating: -1 }
                break;
            case 'featured':
                sortCriteria = { isFeatured: 1 }
                break;
            case 'new':
                sortCriteria = { createdAt: -1 };
                break;
            case 'a-z':
                sortCriteria = { name: 1 };
                break;
            case 'z-a':
                sortCriteria = { name: -1 };
                break;
            default:
                sortCriteria = { createdAt: -1 };
        }      

        let search = req.query.search || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;
        
        let products;
        let totalProducts;

        if (sortOption === 'popularity') {

            
            products = await Orders.aggregate([
                { $unwind: '$products' },
                { 
                    $group: { 
                        _id: '$products.productId', 
                        totalOrdered: { $sum: '$products.quantity' } 
                    } 
                },
                { $sort: { totalOrdered: -1 } },
                { $skip: skip },
                { $limit: limit },
                {
                    $lookup: {
                        from: 'products', // The collection name
                        localField: '_id',
                        foreignField: '_id',
                        as: 'productDetails'
                    }
                },
                { $unwind: '$productDetails' }, // Flatten the product details array
                { $match: { 'productDetails.isListed': true } }, // Apply filter to ensure only listed products
                {
                    $lookup: {
                        from: 'categories', // The collection name for categories
                        localField: 'productDetails.category', // Field in the products collection
                        foreignField: '_id', // Field in the categories collection
                        as: 'categoryDetails'
                    }
                },
                { $unwind: { path: '$categoryDetails', preserveNullAndEmptyArrays: true } }, // Handle missing categories
                {
                    $project: {
                        _id: 1,
                        totalOrdered: 1,
                        name: '$productDetails.name',
                        category: '$categoryDetails.name',
                        sellingPrice: '$productDetails.sellingPrice',
                        mrp: '$productDetails.mrp',
                        image: '$productDetails.image'
                    }
                }
            ]);
            totalProducts = products.length;         
        } else {
            products = await Products.find({ name: { $regex: search, $options: 'i' }, isListed: true })
                .sort(sortCriteria)
                .skip(skip)
                .limit(limit)
                .populate('category', 'name');
            totalProducts = await Products.countDocuments({ name: { $regex: search, $options: 'i' }, isListed: true });
            // totalProducts = products.length;
        }
        
        // const totalProducts = await Products.countDocuments({ name: { $regex: search, $options: 'i' } });
        const totalPages = Math.ceil(totalProducts / limit);

        // res.json({
        //     products: products,
        //     totalProducts: totalProducts,
        //     totalPages: totalPages,
        //     page: page,
        //     limit: limit,
        //     sortOption,
        //     isLoggedIn: !!req.session.user
        // });
    } catch (error) {
        console.log("Error in fetchProducts:", error);
        res.status(500).json({ message: "An error occurred while loading the products." });
    }
};