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
        const session = req.session.user || {};

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        // Fetch products with search and pagination
        const products = await Products.find({
            productName: { $regex: search, $options: 'i' }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('category', 'name');

        // Fetch total count of products based on search term
        const totalProducts = await Products.countDocuments({
            productName: { $regex: search, $options: 'i' }
        });

        const totalPages = Math.ceil(totalProducts / limit);

        const errorMessage = req.session.errorMessage;
        const successMessage = req.session.successMessage;
        req.session.errorMessage = null;
        req.session.successMessage = null;

        res.render('admin/product folder/product-list', {
            products,
            search,
            errorMessage,
            successMessage,
            currentPage:page,
            totalPages,
            limit,
            totalProducts,
            activeTab: "products",
            session
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

        const categories = await Category.find({}, { name: 1 })
        res.render('admin/product folder/product-add', {
            successMessage, errorMessage, categories, activeTab: "products"
        })
    } catch (error) {
        console.error(error)
    }
}

exports.addProduct = async (req, res) => {
    console.log("addProduct called")
    const { productName, description, mrp, productOffer, maxDiscount, category, quantity, isListed } = req.body;
    console.log("productName:", productName);
    console.log("description:", description);
    console.log("mrp:", mrp);
    console.log("productOffer:", productOffer);
    console.log("maxDiscount:", maxDiscount);
    console.log("category:", category);
    console.log("quantity:", quantity);
    console.log("isListed:", isListed);
    try {
        if (!productName || !description || !mrp || !productOffer || !maxDiscount || !category || !quantity || !isListed ) {
            req.session.errorMessage = "All required fields must be filled";
            console.log("Validation failed: Missing required fields");
            return res.redirect('/admin/products/add');
        }
        console.log("Validation passed");
        console.log("helloi")
        const productChk = await Products.findOne({ productName: new RegExp(`^${productName}$`, 'i') })
        console.log("\nproductChk : "+productChk)
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
                productName,
                description,
                mrp,
                productOffer,
                maxDiscount,
                category,
                quantity,
                isListed,
                productImage: image,
            });
            await newProduct.save();
            console.log("Product added successfully");
            req.session.successMessage = "Product added successfully";
            res.redirect('/admin/products');
        } else {
            console.log('Product with same name exists');
            req.session.errorMessage = 'A Product with same name exists'
            res.redirect('/admin/products/add')
        }
    } catch (error) {
        console.error("Error during product creation:", error);
        req.session.errorMessage = "Error saving product";
        res.redirect('/admin/products/add');
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
    try {
        const productId = req.params.id; // Assuming the product ID is passed as a URL parameter
        const productDetails = await Products.findById(productId).populate('category');
        
        if (!productDetails) {
            req.session.errorMessage = "Product not found";
            return res.redirect('/admin/products');
        }

        const categories = await Category.find({}, { name: 1 });
        const isAvailable = Products.schema.path('isAvailable').enumValues;

        res.render('admin/product folder/product-edit', {
            product: productDetails, // Pass the product details here
            successMessage: req.session.successMessage,
            errorMessage: req.session.errorMessage,
            isAvailable,
            categories,
            activeTab: "products"
        });

        // Clear session messages
        req.session.errorMessage = null;
        req.session.successMessage = null;
    } catch (error) {
        console.error("Error loading edit page:", error);
        req.session.errorMessage = "Error loading product details";
        res.redirect('/admin/products');
    }
};

exports.edittingProduct = async (req, res) => {
    const { productId, productName, description, mrp, offer, maxDiscount, category, quantity, isAvailable, isListed, removedImages } = req.body;
    
    // Log the request body to debug
    console.log("Request body:", req.body);

    try {
        const product = await Products.findById(productId);
        if (!product) {
            req.session.errorMessage = "Product not found";
            return res.redirect('/admin/products');
        }

        // Check for duplicate product name
        const duplicateProduct = await Products.findOne({ productName, _id: { $ne: productId } });
        if (duplicateProduct) {
            req.session.errorMessage = "Product with same name exists";
            return res.redirect(`/admin/products/edit/${productId}`);
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
                    product.image.splice(index, 1);
                    const imagePath = path.join('public', 'uploads', 'product-images', img);
                    try {
                        await fs.access(imagePath);
                        await fs.unlink(imagePath);
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

        product.productName = productName;
        product.description = description;
        product.mrp = mrp;
        product.offer = offer;
        product.maxDiscount = maxDiscount;
        product.category = category;
        product.quantity = quantity;
        product.isAvailable = isAvailable;
        product.isListed = isListed;

        await product.save();
        console.log("Product edited successfully");
        req.session.successMessage = "Product Edited";
        res.redirect('/admin/products');
    } catch (error) {
        console.error("Error during editing product:", error);
        req.session.errorMessage = "Error updating product";
        res.redirect('/admin/products');
    }
}

exports.productDetails = async (req, res) => {
    const search = req.query.search || ''; 
    const session = req.session.user;
    const id = req.query.id
    const errorMessage = req.session.errorMessage
    const successMessage = req.session.successMessage
    const productDetails = await Products.findById(id).populate('category', 'name')
    req.session.errorMessage = null
    req.session.successMessage = null
    res.render('admin/product folder/product_details', {
        productDetails, errorMessage, successMessage, activeTab: "products",search,session
    })
}

exports.productDetailsUser = async (req, res) => {
    try {
        const search = req.query.search || ''; 
        const session = req.session.user;
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
            relatedProducts,
            search,session
        });
    } catch (error) {
        console.error('Error in productDetailsUser:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Product page
exports.showProductsPage = async (req, res) => {
    try {
        const search = req.query.search || ''; 
        const session = req.session.user || {};

        let page = 1;
        if(req.query.page){
            page = parseInt(req.query.page);
        }
        const limit = 8;

        let sortField = 'createdAt'; // Default sort field
        let sortOrder = -1; // Default sort order (descending)


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
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit);

        const priceRange = await Products.aggregate([
            {
                $group: {
                    _id: null,
                    minPrice: { $min: "$mrp" },
                    maxPrice: { $max: "$mrp" }
                }
            }
        ]);
        
        const minPrice = Number(priceRange[0]?.minPrice) || 0;
        const maxPrice = Number(priceRange[0]?.maxPrice) || 5000;
        const categories = await Category.find({},{name:1});

        res.render('users/product folder/products', {
            title: "All Products",
            session: session,
            products,
            currentPage: page,
            totalPages,
            search,
            message: req.session.message || '',
            categories,
            minPrice,
            maxPrice
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
        console.log("fetchProducts called")

        const sortOption = req.query.sortBy || 'new';
        let sortCriteria;
        let collationOptions = null;
        switch (sortOption) {
            case 'price-low-high':
                sortCriteria = { mrp: 1 };
                break;
            case 'price-high-low':
                sortCriteria = { mrp: -1 };
                break;
            case 'new':
                sortCriteria = { createdAt: -1 };
                break;
            case 'a-z':
                sortCriteria = { productName: 1 };
                collationOptions = { locale: 'en', strength: 2 };
                break;
            case 'z-a':
                sortCriteria = { productName: -1 };
                collationOptions = { locale: 'en', strength: 2 };
                break;
            default:
                sortCriteria = { createdAt: -1 };
        }      

        let search = req.query.search || '';
        let categoryId = req.query.category || '';

        const minPrice = parseInt(req.query.min, 10) || 0;
        const maxPrice = parseInt(req.query.max, 10) || Infinity;
        const categories = await Category.find({},{name:1});

        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;
        
        let products;
        let totalProducts;

            let query = {
                productName: { $regex: search, $options: 'i' },
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
            
        
        // const totalProducts = await Products.countDocuments({ name: { $regex: search, $options: 'i' } });
        const totalPages = Math.ceil(totalProducts / limit);
            console.log("rendering details : ",products,totalProducts,totalPages,page,limit,sortOption,!!req.session.user,search,
                categories,
                minPrice,
                maxPrice)
        res.json( {
            products: products,
            totalProducts: totalProducts,
            totalPages: totalPages,
            currentPage: page,
            limit: limit,
            sortOption,
            isLoggedIn: !!req.session.user,
            search,
            categories,
            minPrice,
            maxPrice
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'An error occurred while fetching products.' });
    }
};

 
