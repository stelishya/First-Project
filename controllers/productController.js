const Products = require("../models/productSchema");
const Category = require("../models/categorySchema");
const User = require('../models/userSchema');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const sharp = require('sharp');

exports.products = async (req, res) => {
    try {
        let search = req.query.search || '';

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        // Fetch products with search and pagination
        const products = await Products.find({
            name: { $regex: search, $options: 'i' }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('category', 'name');

        // Fetch total count of products based on search term
        const totalProducts = await Products.countDocuments({
            name: { $regex: search, $options: 'i' }
        });

        const totalPages = Math.ceil(totalProducts / limit);

        const errorMessage = req.session.errorMessage;
        const successMessage = req.session.successMessage;
        req.session.errorMessage = null;
        req.session.successMessage = null;

        res.render('admin/product folder/product_list', {
            products,
            errorMessage,
            successMessage,
            page,
            totalPages,
            limit,
            totalProducts,
            activeTab: "products"
        });
    } catch (error) {
        console.error(error);
    }
};

exports.addProductPage = async (req, res) => {
    try {
        //error message handling
        const errorMessage = req.session.errorMessage
        const successMessage = req.session.successMessage
        req.session.errorMessage = null
        req.session.successMessage = null

        //product data handling
        const categories = await Category.find({}, { name: 1 })
        // const categories = (await Categories.find({}, { name: 1, _id: 0 })).map(category => category.name);
        const offerTypes = Products.schema.path('offerType').enumValues;
        res.render('admin/product folder/add_product', {
            successMessage, errorMessage, offerTypes, categories, activeTab: "products"
        })
    } catch (error) {
        console.error(error)
    }
}

exports.addProduct = async (req, res) => {
    const { name, description, price, mrp, offerType, percentage, maxDiscount, fixedAmount, category, stock, tags, status, isListed } = req.body;
    try {
        const tagsArray = tags ? tags.split(',').map(tag => tag.trim()) : [];
        const productChk = await Products.findOne({ name: new RegExp(`^${name}$`, 'i') })
        if (!productChk) {
            const image = [];
            async function saveBase64Image(base64String, filename) {
                const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                await fs.writeFile(`public/uploads/product-images/${filename}`, buffer);
            }
            const { images } = req.body;
    
            try {
                if (images && Array.isArray(images)) {
                    for (const [index, base64Image] of images.entries()) {
                        const filename = `product_${Date.now()}_${index}.png`;
                        await saveBase64Image(base64Image, filename);
                        image.push(filename);
                    }
                }
            } catch (saveError) {
                console.error('Error saving base64 image:', saveError);
                req.session.errorMessage = "Error while saving base64 images";
                return res.redirect('/admin/products');
            }

            const newProduct = new Products({
                name, description, offerType, percentage, isListed, status, maxDiscount, mrp, category, fixedAmount,
                tags: tagsArray,
                sellingPrice: price,
                inventory: stock,
                image: image
            })
            await newProduct.save()
            console.log("Product added successfully");
            req.session.successMessage = "Product added successfully"
            // res.status(200).json("successful")
            res.redirect('/admin/products')
        } else {
            console.log('Product with same name exists');
            req.session.errorMessage = 'A Product with same name exists'
            res.redirect('/admin/products/add')
        }
    } catch (error) {
        console.error("Error during product creation:", error);
        req.session.errorMessage = "Error saving product"
        res.redirect('/admin/products/add')
    }
}

exports.list_unlist = async (req, res) => {
    const catId = req.body.id
    const isListed = req.body.isListed === 'true'
    try {
        await Products.findByIdAndUpdate(catId, { isListed: isListed });
        req.session.successMessage = 'Successfully updated'
        res.redirect('/admin/products')
    } catch (error) {
        console.error(error);
        req.session.errorMessage = 'Not updated'
        res.redirect('/admin/products')
    }
}

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
}

exports.editPage = async (req, res) => {
    const productId = req.query.id;
    const errorMessage = req.session.errorMessage
    const successMessage = req.session.successMessage
    const productDetails = await Products.findById(productId).populate('category')
    req.session.errorMessage = null
    req.session.successMessage = null
    const categories = await Category.find({}, { name: 1 })
    const offerTypes = Products.schema.path('offerType').enumValues;
    const isAvailable = Products.schema.path('isAvailable').enumValues;
    res.render('admin/product folder/edit_product', {
        productDetails, successMessage, errorMessage, offerTypes, isAvailable, categories, activeTab: "products"
    })
}

exports.edittingProduct = async (req, res) => {
    const { originalName, name, description, price, mrp, offerType, offer, maxDiscount, fixedAmount, category, stock, tags, isAvailable, isListed, removedImages } = req.body;
    const tagsArray = tags ? tags.split(',').map(tag => tag.trim()) : [];
    try {
        const product = await Products.findOne({ name: originalName.trim() });
        if (!product) {
            req.session.errorMessage = "Product not found";
            return res.redirect('/admin/products');
        }
        async function saveBase64Image(base64String, filename) {
            const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            await fs.writeFile(`public/uploads/product-images/${filename}`, buffer);
        }
        const { images } = req.body;

        try {
            if (images && Array.isArray(images)) {
                for (const [index, base64Image] of images.entries()) {
                    const filename = `product_${Date.now()}_${index}.png`;
                    await saveBase64Image(base64Image, filename);
                    product.image.push(filename);
                }
            }
        } catch (saveError) {
            console.error('Error saving base64 image:', saveError);
            req.session.errorMessage = "Error while saving base64 images";
            return res.redirect('/admin/products');
        }

        if (removedImages) {
            const imagesToRemove = Array.isArray(removedImages) ? removedImages : [removedImages];
            for (const img of imagesToRemove) {
                const index = product.image.indexOf(img);
                if (index > -1) {
                    product.image.splice(index, 1); // Remove from images array
                    
                    // Construct the full path to the image
                    const imagePath = path.join('public', 'uploads', 'product-images', img);
                    
                    // Check if the file exists before trying to delete it
                    try {
                        await fs.access(imagePath); // Check if the file exists
                        await fs.unlink(imagePath); // Delete the file
                        console.log(`Deleted image: ${img}`);
                    } catch (err) {
                        if (err.code === 'ENOENT') {
                            console.log(`Image not found, skipping deletion: ${img}`);
                        } else {
                            console.error(`Error deleting image ${img}:`, err);
                        }
                    }
                }
            }
        }
        await Products.findOneAndUpdate({ name: originalName }, {
            name, description, offerType, offer, isListed, isAvailable, maxDiscount, mrp, category, fixedAmount,
            tags: tagsArray,
            sellingPrice: price,
            inventory: stock,
            image:product.image
        })
        console.log("Product edited successfully");
        req.session.successMessage = "Product Edited"
        res.redirect('/admin/products')
    } catch (error) {
        console.error("Error during editting product:", error);
        req.session.errorMessage = "Product with same name exists"
        res.redirect('/admin/products')
    }
}

exports.productDetails = async (req, res) => {
    const id = req.query.id
    const errorMessage = req.session.errorMessage
    const successMessage = req.session.successMessage
    const productDetails = await Products.findById(id).populate('category', 'name')
    req.session.errorMessage = null
    req.session.successMessage = null
    res.render('admin/product folder/product_details', {
        productDetails, errorMessage, successMessage, activeTab: "products"
    })
}

exports.productDetailsUser = async (req, res) => {
    try {
        const productId = req.params.productId;
        const deliveryDate = new Date(new Date().setDate(new Date().getDate() + 5))
            .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        
        const productDetails = await Products.findById(productId).populate('category', 'name');
        if (!productDetails) {
            return res.status(404).send('Product not found');
        }

        // Get related products from same category
        const relatedProducts = await Products.find({
            category: productDetails.category._id,
            _id: { $ne: productId }  // Exclude current product
        })
        .populate('category', 'name')
        .limit(4);  // Show only 4 related products

        res.render('users/product folder/product', {
            title: productDetails.productName,
            user: req.session.user || null,
            product: productDetails,
            deliveryDate,
            relatedProducts
        });
    } catch (error) {
        console.error('Error in productDetailsUser:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Product page
exports.showProductsPage = async (req, res) => {
    try {
        let search = '';
        if(req.query.search){
            search = req.query.search;
        }
        let page = 1;
        if(req.query.page){
            page = parseInt(req.query.page);
        }
        const limit = 8;

        const count = await Products.find({
            $or:[
                {productName: {$regex: ".*"+search+".*", $options: 'i'}},
                {description: {$regex: ".*"+search+".*", $options: 'i'}}
            ]
        }).countDocuments();

        const totalPages = Math.ceil(count / limit);
        const skip = (page - 1) * limit;

        const products = await Products.find({
            $or:[
                {productName: {$regex: ".*"+search+".*", $options: 'i'}},
                {description: {$regex: ".*"+search+".*", $options: 'i'}}
            ]
        })
        .skip(skip)
        .limit(limit);

        res.render('users/product folder/products', {
            title: "All Products",
            session: req.session.user,
            products,
            currentPage: page,
            totalPages,
            search,
            message: req.session.message || ''
        });

        // Clear any flash messages
        delete req.session.message;
    } catch (error) {
        console.error('Error in showProductsPage:', error);
        req.session.message = 'Error loading products. Please try again.';
        res.redirect('/user/home');
    }
};

// Dynamic product update
exports.fetchProducts = async (req, res) => {
    try {
        const sortOption = req.query.sortBy || 'new';
        let sortCriteria;
        let collationOptions = null;
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
                collationOptions = { locale: 'en', strength: 2 };
                break;
            case 'z-a':
                sortCriteria = { name: -1 };
                collationOptions = { locale: 'en', strength: 2 };
                break;
            default:
                sortCriteria = { createdAt: -1 };
        }      

        let search = req.query.search || '';
        let categoryId = req.query.category || '';

        const minPrice = parseInt(req.query.min, 10) || 0;
        const maxPrice = parseInt(req.query.max, 10) || Infinity;
        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;
        
        let products;
        let totalProducts;

        if (sortOption === 'popularity') {

            // products = await Products.aggregate([
            //     // Step 1: Lookup totalOrdered from Orders
            //     {
            //         $lookup: {
            //             from: 'orders',
            //             let: { productId: '$_id' },
            //             pipeline: [
            //                 { $unwind: '$products' }, // Unwind products array in Orders
            //                 {
            //                     $match: {
            //                         $expr: { $eq: ['$products.productId', '$$productId'] } // Match productId
            //                     }
            //                 },
            //                 {
            //                     $group: {
            //                         _id: '$products.productId',
            //                         totalQuantity: { $sum: '$products.quantity' } // Sum up the quantities
            //                     }
            //                 }
            //             ],
            //             as: 'orderData'
            //         }
            //     },
            //     // Step 2: Add totalOrdered field (default to 0 if no orders)
            //     {
            //         $addFields: {
            //             totalOrdered: {
            //                 $ifNull: [{ $arrayElemAt: ['$orderData.totalQuantity', 0] }, 0]
            //             }
            //         }
            //     },
            //     // Step 3: Remove the orderData array (no longer needed)
            //     {
            //         $project: {
            //             orderData: 0
            //         }
            //     },
            //     // Step 4: Lookup category details
            //     {
            //         $lookup: {
            //             from: 'categories',
            //             localField: 'category',
            //             foreignField: '_id',
            //             as: 'categoryDetails'
            //         }
            //     },
            //     // Step 5: Unwind category details (handle missing categories gracefully)
            //     {
            //         $unwind: {
            //             path: '$categoryDetails',
            //             preserveNullAndEmptyArrays: true
            //         }
            //     },
            //     // Step 6: Sort products by totalOrdered (descending), then by name (ascending for tie-breaking)
            //     {
            //         $sort: {
            //             totalOrdered: -1,
            //             name: 1
            //         }
            //     },
            //     // Step 7: Apply pagination (skip and limit)
            //     { $skip: skip },
            //     { $limit: limit },
            //     // Step 8: Project the final fields
            //     {
            //         $project: {
            //             _id: 1,
            //             name: 1,
            //             mrp: 1,
            //             sellingPrice: 1,
            //             image: 1,
            //             totalOrdered: 1,
            //             category: '$categoryDetails.name'
            //         }
            //     }
            // ]);            
            // console.log(products)
            // totalProducts = await Products.countDocuments({ isListed: true });                       

            // const mostOrderedProducts = await Orders.aggregate([
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
            let query = {
                name: { $regex: search, $options: 'i' },
                isListed: true,
                mrp: { $gte: minPrice, $lte: maxPrice}
            };
            
            if (categoryId) {
                query.category = categoryId;
            }
            
            products = await Products.find(query)
                .sort(sortCriteria)
                .collation(collationOptions)
                .skip(skip)
                .limit(limit)
                .populate('category', 'name');
            totalProducts = await Products.countDocuments(query);
            // totalProducts = products.length;
        }
        
        // const totalProducts = await Products.countDocuments({ name: { $regex: search, $options: 'i' } });
        const totalPages = Math.ceil(totalProducts / limit);

        res.json({
            products: products,
            totalProducts: totalProducts,
            totalPages: totalPages,
            page: page,
            limit: limit,
            sortOption,
            isLoggedIn: !!req.session.user
        });
    } catch (error) {
        console.log("Error in fetchProducts:", error);
        res.status(500).json({ message: "An error occurred while loading the products." });
    }
};

//********************************************** */

// // Ensure product images directory exists
// const productImagesDir = path.join(__dirname, '../../public/uploads/product-images');
// if (!fsSync.existsSync(productImagesDir)) {
//     fsSync.mkdirSync(productImagesDir, { recursive: true });
// }

// exports.products = async (req, res) => {
//     try {
//         let search='';
//         if(req.query.search){
//             search = req.query.search
//         }
//         let page=1;
//         if(req.query.page){
//             page=req.query.page 
//         }
//         const limit=3;

//         const userData = await User.find({
//             is_admin:false,
//             $or:[
//                 {name:{$regex:".*"+search+".*"}},
//                 {email:{$regex:".*"+search+".*"}}
//             ],
//         })
//         .limit(limit*1)
//         .skip((page-1)*limit)
//         .exec();
//         const count = await User.find({
//             is_admin:false,
//             $or:[
//                 {name:{$regex:".*"+search+".*"}},
//                 {email:{$regex:".*"+search+".*"}}
//             ],
//         }).countDocuments()
//         const totalPages = Math.ceil(count /limit);
//         const currentPage = page;

//         const products = await Products.find().populate('category');
//         const errorMessage = req.session.errorMessage;
//         const successMessage = req.session.successMessage;
        
//         console.log("products",products);

//         req.session.errorMessage = null;
//         req.session.successMessage = null;
//         // totalPages=0;

//         res.render('admin/product-list', {
//             products,
//             errorMessage,
//             successMessage,
//             activeTab: "products",
//             userData,
//             count,
//             totalPages,
//             currentPage
//         });
//     } catch (error) {
//         console.error('Error in products:', error);
//         req.session.errorMessage = 'Error loading products';
//         res.redirect('/admin/dashboard');
//     }
// };

// exports.addProductPage = async (req, res) => {
//     try {
//         const categories = await Category.find({}, { name: 1 });
//         const errorMessage = req.session.errorMessage;
//         const successMessage = req.session.successMessage;
        
//         req.session.errorMessage = null;
//         req.session.successMessage = null;

//         res.render('admin/product-add', {
//             categories,
//             errorMessage,
//             successMessage,
//             activeTab: "products"
//         });
//     } catch (error) {
//         console.error('Error in addProductPage:', error);
//         req.session.errorMessage = 'Error loading add product page';
//         res.redirect('/admin/products');
//     }
// };

// exports.addProduct = async (req, res) => {
//     try {
//         const {
//             productName,
//             description,
//             mrp,
//             quantity,
//             productOffer,
//             category,
//             images
//         } = req.body;

//         // Process and save images
//         const imageFilenames = [];
//         if (images && Array.isArray(images)) {
//             for (let [index, base64Image] of images.entries()) {
//                 const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
//                 const imageBuffer = Buffer.from(base64Data, 'base64');

//                 // Process image with Sharp
//                 const processedImageBuffer = await sharp(imageBuffer)
//                     .resize(800, 800, {
//                         fit: 'contain',
//                         background: { r: 255, g: 255, b: 255, alpha: 1 }
//                     })
//                     .webp({ quality: 80 })
//                     .toBuffer();

//                 // Generate unique filename
//                 const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '').split('.')[0];
//                 const filename = `product_image-${timestamp}-${index}.webp`;

//                 // Save the processed image
//                 await fs.writeFile(
//                     path.join(__dirname, '../../public/uploads/product-images', filename),
//                     processedImageBuffer
//                 );

//                 imageFilenames.push(filename);
//             }
//         }

//         // Create new product
//         const product = new Products({
//             productName,
//             description,
//             mrp,
//             quantity,
//             productOffer: productOffer || 0,
//             category,
//             productImage: imageFilenames,
//             isListed: true
//         });

//         await product.save();

//         req.session.successMessage = 'Product added successfully';
//         res.redirect('/admin/products');
//     } catch (error) {
//         console.error('Error in addProduct:', error);
//         req.session.errorMessage = 'Error adding product';
//         res.redirect('/admin/products/add');
//     }
// };

// exports.editPage = async (req, res) => {
//     try {
//         console.log("edit page vann")
//         const productId = req.params.id;
//         const product = await Products.findById(productId).populate('category');
//         console.log("product:",product)
        
//         if (!product) {
//             req.session.errorMessage = 'Product not found';
//             return res.redirect('/admin/products');
//         }

//         const categories = await Category.find({}, { name: 1 });
//         const errorMessage = req.session.errorMessage;
//         const successMessage = req.session.successMessage;
        
//         req.session.errorMessage = null;
//         req.session.successMessage = null;

//         res.render('admin/product-edit', {
//             product,
//             categories,
//             errorMessage,
//             successMessage,
//             activeTab: "products"
//         });
//     } catch (error) {
//         console.error('Error in editPage:', error);
//         req.session.errorMessage = 'Error loading product edit page';
//         res.redirect('/admin/products');
//     }
// };

// exports.editProduct = async (req, res) => {
//     try {
//         const productId = req.params.id;
//         const {
//             productName,
//             description,
//             mrp,
//             quantity,
//             productOffer,
//             category,
//             removedImages,
//             newImages
//         } = req.body;

//         // Get the product
//         const product = await Products.findById(productId);
//         if (!product) {
//             req.session.errorMessage = 'Product not found';
//             return res.redirect('/admin/products');
//         }

//         // Handle removed images
//         if (removedImages) {
//             const imagesToRemove = JSON.parse(removedImages);
//             for (const img of imagesToRemove) {
//                 const index = product.productImage.indexOf(img);
//                 if (index > -1) {
//                     product.productImage.splice(index, 1);
                    
//                     // Delete the file
//                     const imagePath = path.join(__dirname, '../../public/uploads/product-images', img);
//                    
//                     // Check if the file exists before trying to delete it
//                     try {
//                         await fs.access(imagePath); // Check if the file exists
//                         await fs.unlink(imagePath); // Delete the file
//                     } catch (err) {
//                         console.error(`Error deleting image ${img}:`, err);
//                     }
//                 }
//             }
//         }

//         // Handle new images
//         if (newImages && Array.isArray(newImages)) {
//             for (let [index, base64Image] of newImages.entries()) {
//                 const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
//                 const imageBuffer = Buffer.from(base64Data, 'base64');

//                 // Process image with Sharp
//                 const processedImageBuffer = await sharp(imageBuffer)
//                     .resize(800, 800, {
//                         fit: 'contain',
//                         background: { r: 255, g: 255, b: 255, alpha: 1 }
//                     })
//                     .webp({ quality: 80 })
//                     .toBuffer();

//                     console.log("processedImageBuffer :",processedImageBuffer)

//                 // Generate unique filename
//                 const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '').split('.')[0];
//                 const filename = `product_image-${timestamp}-${index}.webp`;

//                 // Save the processed image
//                 await fs.writeFile(
//                     path.join(__dirname, '../../public/uploads/product-images', filename),
//                     processedImageBuffer
//                 );

//                 product.productImage.push(filename);
//             }
//         }

//         // Update other fields
//         product.productName = productName;
//         product.description = description;
//         product.mrp = mrp;
//         product.quantity = quantity;
//         product.productOffer = productOffer || 0;
//         product.category = category;

//         // Save the updated product
//         await product.save();

//         req.session.successMessage = 'Product updated successfully';
//         res.redirect('/admin/products');
//     } catch (error) {
//         console.error('Error in editProduct:', error);
//         req.session.errorMessage = 'Error updating product';
//         res.redirect(`/admin/products/edit/${req.params.id}`);
//     }
// };

// exports.list_unlist = async (req, res) => {
//     try {
//         const productId = req.params.id;
//         const action = req.params.action;

//         if (!['list', 'unlist'].includes(action)) {
//             return res.status(400).json({ error: 'Invalid action' });
//         }

//         const product = await Products.findById(productId);
//         if (!product) {
//             return res.status(404).json({ error: 'Product not found' });
//         }

//         product.isListed = action === 'list';
//         await product.save();

//         res.json({ success: true, message: `Product ${action}ed successfully` });
//     } catch (error) {
//         console.error('Error in list_unlist:', error);
//         res.status(500).json({ error: 'Server error' });
//     }
// };

// exports.productDetails = async (req, res) => {
//     try {
//         const productId = req.params.productId;
//         const product = await Products.findById(productId).populate('category');
        
//         if (!product) {
//             req.session.errorMessage = 'Product not found';
//             return res.redirect('/user/products');
//         }

//         res.render('users/product folder/product', {
//             product, 
//             relatedProducts:[],
//             activeTab: "products"
//         });
//     } catch (error) {
//         console.error('Error in productDetails:', error);
//         req.session.errorMessage = 'Error loading product details';
//         res.redirect('/user/products');
//     }
// };

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

// // Product page
// exports.showProductsPage = async (req, res) => {
//     const session = req.session.user || {}; // Check if a user is logged in
//     const title = "All Products";
//     try {
//         const priceRange = await Products.aggregate([
//             {
//                 $group: {
//                     _id: null,
//                     minPrice: { $min: "$mrp" },
//                     maxPrice: { $max: "$mrp" }
//                 }
//             }
//         ]);
//         const minPrice = Number(priceRange[0]?.minPrice) || 0;
//         const maxPrice = Number(priceRange[0]?.maxPrice) || 5000;

//         const categories = await Category.find({},{name:1});
//         res.render('users/product folder/products', {
//             title,
//             session: session ? session.username || session.fullname : null,// Use null if session or username is undefined
//             categories,
//             minPrice,
//             maxPrice
//         });
//     } catch(error) {
//         console.error(error);
//     }
// };

// // Dynamic product update
// exports.fetchProducts = async (req, res) => {
//     try {
//         const page = parseInt(req.query.page) || 1;
//         const limit = 8;
//         const skip = (page - 1) * limit;
        
//         const products = await Products.find({ isListed: true })
//             .sort({ createdAt: -1 })
//             .skip(skip)
//             .limit(limit)
//             .populate('category', 'name');

//         const totalProducts = await Products.countDocuments({ isListed: true });
//         const totalPages = Math.ceil(totalProducts / limit);

//         res.json({
//             products,
//             totalProducts,
//             totalPages,
//             page,
//             limit
//         });
//     } catch (error) {
//         console.log("Error in fetchProducts:", error);
//         res.status(500).json({ message: "An error occurred while loading the products." });
//     }
// };