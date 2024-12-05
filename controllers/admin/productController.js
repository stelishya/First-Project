const Products = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require('../../models/userSchema');
const fs = require("fs").promises;
const path = require("path");
const sharp = require("sharp");

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

        res.render('admin/product-list', {
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
        console.error('Error in products:', error);
        res.status(500).render('admin/product-list', {
            products: [],
            errorMessage: 'Error loading products',
            successMessage: null,
            page: 1,
            totalPages: 1,
            limit: 5,
            totalProducts: 0,
            activeTab: "products"
        });    
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

        res.render('user/product folder/product', {
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

    res.render('user/product folder/products', {
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

















// exports.getProductAddPage = async (req,res)=>{
//     try {
//         const categories = await Category.find({ isListed: true }).sort({ name: 1 });

//         res.render('admin/product-add', {
//             title: 'Add Product',
//             categories: categories || [], // Provide empty array as fallback
//             path: '/admin/product-add'
//         });
//         // const category = await Category.find({ isListed: true });
//         // return res.render("admin/product-add", { cat:category });
//     } catch (error) {
//         console.error('Error in getProductAddPage:',error);
//         res.render('admin/product-add', {
//             title: 'Add Product',
//             categories: [],
//             path: '/admin/product-add'
//         });
//         // return res.redirect("/pageError");
//     }
// }

// exports.addProducts = async(req,res)=>{
//     try {
//         const products = req.body;
//         const productExists = await Product.findOne({ 
//             productName: products.productName });

//         if (!productExists) {
//           const images = [];
//           if (req.files && req.files.length > 0) {
//             for (let i = 0; i < req.files.length; i++) {
//               const originalImagePath = req.files[i].path;
//               const resizedImagePath = path.join('public', 'uploads', 'product-images', req.files[i].filename);
//               await sharp(originalImagePath).resize({ width: 440, height: 440 }).toFile(resizedImagePath);
//               images.push(req.files[i].filename);
//             }
//           }
//           const categoryId = await Category.findOne({ name: products.category });

//           if (!categoryId) {
//               return res.status(400).json("Invalid category name");
//           }
          
//           const newProduct = new Product({
//               productName: products.productName,
//               description: products.description,
//             //   brand: products.brand,
//               category: categoryId._id,
//               regularPrice: products.regularPrice,
//               salePrice: products.salePrice,
//               createdOn: new Date(),
//               quantity: products.quantity,
//               size: products.size,
//             //   color: products.color,
//               productImage: images, // Assuming images is an array of image filenames
//               status: 'Available'
//           });
          
//           await newProduct.save();
//          return res.redirect("/admin/addProducts");
      
//         } else{
//             return res.status(400).json("Product already exist,please try with another name")
//         }
//     } catch (error) {
//         console.error("Error saving product",error);
//         return res.redirect('/admin/pageError')
//     }
// }