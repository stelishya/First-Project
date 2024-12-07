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
        
        console.log("products",products);

        
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
        console.log("edit page vann")
        const productId = req.params.id;
        const product = await Products.findById(productId).populate('category');
        console.log("product:",product)
        
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
        const productId = req.params.productId;
        const product = await Products.findById(productId).populate('category');
        
        if (!product) {
            req.session.errorMessage = 'Product not found';
            return res.redirect('/user/products');
        }

        res.render('users/product folder/product', {
            product, 
            relatedProducts:[],
            activeTab: "products"
        });
    } catch (error) {
        console.error('Error in productDetails:', error);
        req.session.errorMessage = 'Error loading product details';
        res.redirect('/user/products');
    }
};

// exports.deleteProduct = async (req, res) => {
//     const catId = req.query.id
//     try {
//         const result = await Products.findByIdAndDelete(catId);
//         if (result) {
//             req.session.successMessage = "Product deleted succesfully"
//             res.redirect('/admin/products')
//         } else {
//             req.session.errorMessage = "Couldn't delete the product"
//             res.redirect('/admin/products')
//         }
//     } catch (err) {
//         console.error(err);
//         req.session.errorMessage = "Couldn't delete the product"
//         res.redirect('/admin/products')
//     }
// };

// exports.getProductDetails = async (req, res) => {
//     try {
//         const productId = req.params.productId;
//         const deliveryDate = new Date(new Date().setDate(new Date().getDate() + 5))
//             .toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

//         const productDetails = await Products.findById(productId)
//             .populate('category', 'name categoryOffer')
//             .select('productName description mrp productImage productOffer category quantity status');

//         if (!productDetails) {
//             return res.status(404).render('users/404', { message: 'Product not found' });
//         }

//         // Calculate discounted price and best discount
//         const productOffer = productDetails.productOffer || 0;
//         const categoryOffer = productDetails.category?.categoryOffer || 0;
//         const bestDiscount = Math.max(
//             Math.floor(productDetails.mrp * (productOffer / 100)),
//             Math.floor(productDetails.mrp * (categoryOffer / 100))
//         );
//         const discountedPrice = productDetails.mrp - bestDiscount;

//         // Get stock status
//         let stockStatus = {
//             status: 'IN_STOCK',
//             message: 'In Stock',
//             class: 'text-green-600 bg-green-100'
//         };

//         if (productDetails.quantity <= 0) {
//             stockStatus = {
//                 status: 'OUT_OF_STOCK',
//                 message: 'Out of Stock',
//                 class: 'text-red-600 bg-red-100'
//             };
//         } else if (productDetails.quantity <= 5) {
//             stockStatus = {
//                 status: 'LOW_STOCK',
//                 message: `Only ${productDetails.quantity} left`,
//                 class: 'text-yellow-600 bg-yellow-100'
//             };
//         }

//         // Get related products
//         const relatedProducts = await Products.find({
//             category: productDetails.category._id,
//             _id: { $ne: productId },
//             status: 'Available',
//             isListed: true
//         })
//         .select('productName productImage mrp productOffer')
//         .limit(4);

//         // Format product data
//         const formattedProduct = {
//             _id: productDetails._id,
//             name: productDetails.productName,
//             description: productDetails.description,
//             mrp: productDetails.mrp,
//             discountedPrice,
//             bestDiscount,
//             offer: productOffer,
//             category: productDetails.category,
//             image: productDetails.productImage,
//             inventory: productDetails.quantity,
//             stockStatus,
//             rating: 4.5 // Default rating for now
//         };

//         res.render('users/product folder/product', {
//             product: formattedProduct,
//             relatedProducts: relatedProducts.map(p => ({
//                 _id: p._id,
//                 name: p.productName,
//                 image: p.productImage[0],
//                 mrp: p.mrp,
//                 offer: p.productOffer
//             })),
//             deliveryDate
//         });

//     } catch (error) {
//         console.error('Error in getProductDetails:', error);
//         res.status(500).render('users/page-404', { error: 'Internal Server Error' });
//     }
// };

// Product page
exports.showProductsPage = async (req, res) => {
    const session = req.session.user || {}; // Check if a user is logged in
    const title = "All Products";
    const products = await Products.find({});

    res.render('users/product folder/products', {
        title,
        session: session ? session.username || session.fullname : null,// Use null if session or username is undefined
        products 
    });
};

// Dynamic product update
exports.fetchProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;
        
        const products = await Products.find({ isListed: true })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('category', 'name');

        const totalProducts = await Products.countDocuments({ isListed: true });
        const totalPages = Math.ceil(totalProducts / limit);

        res.json({
            products,
            totalProducts,
            totalPages,
            page,
            limit
        });
    } catch (error) {
        console.log("Error in fetchProducts:", error);
        res.status(500).json({ message: "An error occurred while loading the products." });
    }
};