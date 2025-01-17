const Products = require("../models/productSchema");
const Category = require("../models/categorySchema");
const User = require('../models/userSchema');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const sharp = require('sharp');
const { calculateProductPrices, calculateOrderItemPrices } = require('../helpers/priceCalculator');

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
    const { productName, description, mrp, productOffer, maxDiscount, category, stock, isListed } = req.body;
    console.log("productName:", productName);
    console.log("description:", description);
    console.log("mrp:", mrp);
    console.log("productOffer:", productOffer);
    console.log("maxDiscount:", maxDiscount);
    console.log("category:", category);
    console.log("stock:", stock);
    console.log("isListed:", isListed);
    try {
        if (!productName || !description || !mrp || !productOffer || !maxDiscount || !category || !stock || !isListed ) {
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
                stock,
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
    // const catId = req.body.id
    // const isListed = req.body.isListed === 'true'
    try {
        const productId = req.params.id;
        const action = req.params.action;
        const isListed = action === 'list';

        await Products.findByIdAndUpdate(productId, { isListed: isListed });
        return res.status(200).json({ message: 'Product status updated successfully' });

        // req.session.successMessage = 'Successfully updated'
        // res.redirect('/admin/products')
    } catch (error) {
        console.error('Error updating product status:',error);
        return res.status(500).json({ message: 'Failed to update product status' });

        // req.session.errorMessage = 'Not updated'
        // res.redirect('/admin/products')
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
        const productId = req.params.id; 
        const productDetails = await Products.findById(productId)
            .populate('category')
            .select('productName description mrp productOffer maxDiscount category stock isAvailable isListed productImage')
            .lean();
        
        if (!productDetails) {
            req.session.errorMessage = "Product not found";
            return res.redirect('/admin/products');
        }

        const categories = await Category.find({isListed: true}, { name: 1 }).lean();
        const isAvailable = Products.schema.path('isAvailable').enumValues;

        console.log('Product Category:', productDetails.category);
        console.log('Available Categories:', categories);

        res.render('admin/product folder/product-edit', {
            product: productDetails, 
            successMessage: req.session.successMessage,
            errorMessage: req.session.errorMessage,
            isAvailable:isAvailable,
            categories:categories,
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
    
    try {
        const { productId, productName, description, mrp, productOffer, maxDiscount, category, stock, isAvailable } = req.body;
        const isListed = req.body.isListed === 'true';
        console.log("isListed value:", isListed);

        const removedImages = req.body.removedImages ? JSON.parse(req.body.removedImages) : [];
        const newImages = req.body.newImages ? JSON.parse(req.body.newImages) : [];

        console.log("Request body:", req.body);

        const product = await Products.findById(productId).populate('category');
        if (!product) {
            req.session.errorMessage = "Product not found"
            return res.redirect("/admin/products")
            // throw new Error('Product not found');
        }
        // Check for duplicate product name
        const duplicateProduct = await Products.findOne({ productName, _id: { $ne: productId } });
        if (duplicateProduct) {
            req.session.errorMessage = "Product with same name exists";
            return res.redirect(`/admin/products/edit/${productId}`);
        }
        const categoryExists = await Category.findById(category);
        if (!categoryExists) {
            req.session.errorMessage = "Invalid category selected";
            return res.redirect("/admin/products");
        }

        const prices = calculateProductPrices({
            mrp: Number(mrp),
            productOffer: Number(productOffer),
            category: { categoryOffer: Number(categoryExists.categoryOffer || 0) },
            maxDiscount: Number(maxDiscount)
        });

        // // Get offers from both product and category
        // const productOffer = product.productOffer || 0;
        // const categoryOffer = product.category.categoryOffer || 0;  

        // let offer = Math.max(productOffer,categoryOffer)
        // const finalAmount = 0;
        //  // Calculate prices using the helper
        //  const prices = calculateProductPrices({
        //     mrp: Number(mrp),
        //     productOffer: Number(productOffer),
        //     category: { categoryOffer: Number(categoryOffer) },
        //     maxDiscount: Number(maxDiscount)
        // });
        // console.log("prices in edit pro:",prices)
        
        // product.productName = productName;
        // product.description = description;
        // product.mrp = mrp;
        // product.productOffer = productOffer;
        // product.offer = offer;
        // product.finalAmount = prices.finalAmount;
        // product.discount = prices.discount;
        // product.maxDiscount = prices.maxDiscount;
        // // product.category = category;
        // product.stock = stock;
        // product.isAvailable = isAvailable;
        // product.isListed = isListed;

        async function saveBase64Image(base64String, filename) {
            const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            await fs.writeFile(`public/uploads/product-images/${filename}`, buffer);
        }
        let productImages = [...product.productImage]; 
        const { images } = req.body;

        try {
            if (images && Array.isArray(images)) {
                for (const [index, base64Image] of images.entries()) {
                    const filename = `product_${Date.now()}_${index}.png`;
                    await saveBase64Image(base64Image, filename);
                    // product.productImage.push(filename);
                    productImages.push(filename);
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
                const index = product.productImage.indexOf(img);
                if (index > -1) {
                    // product.productImage.splice(index, 1);
                    productImages.splice(index, 1);
                    const imagePath = path.join('public', 'uploads', 'product-images', img);
                    try {
                        await fs.access(imagePath);
                        await fs.unlink(imagePath);
                        console.log(`Deleted image: ${img}`);
                    } catch (err) {
                        console.error(`Error deleting image ${img}:`, err);

                        // if (err.code === 'ENOENT') {
                        //     console.log(`Image not found, skipping deletion: ${img}`);
                        // } else {
                        //     console.error(`Error deleting image ${img}:`, err);
                        // }
                    }
                }
            }
        }
        // await Products.findOneAndUpdate({productName:productName},{
        //     productName,description,offer,isListed,isAvailable,maxDiscount,mrp,category,finalAmount,stock,productImage:product.productImage
        // })
        const updatedProduct = await Products.findByIdAndUpdate(productId, {
            productName,
            description,
            mrp: Number(mrp),
            productOffer: Number(productOffer),
            maxDiscount: Number(maxDiscount),
            category: categoryExists._id,
            stock: Number(stock),
            isAvailable,
            isListed: isListed,
            productImage: productImages,
            finalAmount: prices.finalAmount,
            discount: prices.totalDiscount
        },{new:true});
        console.log("Updated product:", updatedProduct); 
        console.log("Product edited successfully");
        req.session.successMessage = "Product Edited Successfully";
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
        
        const product = await Products.findById(productId).populate('category', 'name categoryOffer').lean();
        console.log("product Details from DB:",product)
        if (!product) {
            console.log("Product not found for ID:", productId);
            return res.status(404).render('users/page-404', { message: "Product not found.",
                error: 'The requested product could not be found' });
        }
        const prices = calculateProductPrices(product);
        const productsWithPrices = {
            ...product,
            discountedPrice: prices.finalAmount,
            mrp: prices.mrp,
            offer: prices.offer,
            discount: prices.Discount,
        }
        
        const relatedProducts = await Products.find({
            category: product.category._id,
            _id: { $ne: productId }  // Exclude current product
        })
        .populate('category', 'name')
        .limit(4);  // Show only 4 related products
        res.render('users/product folder/product', {
            user: req.session.user || null,
            product:productsWithPrices,
            deliveryDate,
            relatedProducts,
            search,session
        });
    } catch (error) {
        console.error('Error in productDetailsUser:', error);
        res.status(500).render('page-404', { 
            message: 'Error loading product details',
            error: error.message 
        });
    }
};

// Product page
exports.showProductsPage = async (req, res) => {
    try {
        const search = req.query.search || ''; 
        const session = req.session.user || {};
        const page = parseInt(req.query.page) || 1;
        const limit = 9;

        let sortField = 'createdAt'; 
        let sortOrder = -1; 


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
        .populate('category') 
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(); 

        const productsWithPrices = products.map(product => {
            const prices = calculateProductPrices(product);
            return {
                ...product,
                offer: prices.offer||0,
                discount:prices.Discount||0,
                finalAmount:prices.finalAmount ||0, 
                discountedPrice: prices.priceAfterDiscount||0, 
            }
        });
        // // Calculate final amounts for each product
        //     const productsWithPrices = products.map(product => {
        //     const productOffer = Number(product.productOffer || 0);
        //     const categoryOffer = Number(product.category?.categoryOffer || 0);
            
        //     // Get the better offer
        //     let offer = Math.max(productOffer, categoryOffer);
            
        //     // Calculate final amounts
        //     const mrp = Number(product.mrp || 0);
        //     const discount = Math.round((mrp * offer / 100) * 100) / 100;
        //     const finalAmount = Math.round((mrp - discount) * 100) / 100;
        //     return {
        //         ...product,
        //         offer:offer|| 0,
        //         mrp:mrp || 0,
        //         discount:discount || 0,
        //         finalAmount:finalAmount || mrp
        //     };
        // });
        console.log("productsWithPrices : ",productsWithPrices)
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
            products: productsWithPrices,
            currentPage: page,
            totalPages,
            search,
            message: req.session.message || '',
            categories,
            minPrice,
            maxPrice
        });

        
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
        console.log("fetchProducts called with params:", req.query);
        
        const sortOption = req.query.sortBy || '';
        let sortCriteria = { createdAt: -1 }; // Default sort by newest

        if (sortOption) {
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
                    break;
                case 'z-a':
                    sortCriteria = { productName: -1 };
                    break;
            }
        }

        let search = req.query.search || '';
        let categoryId = req.query.category || '';

        const minPrice = parseInt(req.query.min, 10) || 0;
        const maxPrice = parseInt(req.query.max, 10) || Infinity;
        const categories = await Category.find({}, { name: 1 });

        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

        let query = {
            productName: { $regex: search, $options: 'i' },
            isListed: true,
            mrp: { $gte: minPrice, $lte: maxPrice }
        };

        if (categoryId) {
            query.category = categoryId;
        }
        if (search) {
            query.$or = [
                { productName: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const products = await Products.find(query)
            .sort(sortCriteria)
            .skip(skip)
            .limit(limit)
            .populate('category', 'name categoryOffer')
            .lean();

        const productsWithPrices = products.map(product => {
            const prices = calculateProductPrices(product);
            return {
                ...product,
                offer: prices.offer||0,
                discount:prices.Discount||0,
                finalAmount:prices.finalAmount || product.mrp, 
                discountedPrice: prices.priceAfterDiscount || product.mrp 
            }
        });

        const totalProducts = await Products.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        console.log("Sending response:", {
            products: productsWithPrices.length,
            totalProducts,
            totalPages,
            currentPage: page
        });

        res.json({ 
            products: productsWithPrices,
            totalProducts,
            totalPages,
            currentPage: page,
            limit,
            sortOption,
            isLoggedIn: !!req.session.user,
            search,
            categories,
            minPrice,
            maxPrice
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ 
            error: 'An error occurred while fetching products.',
            details: error.message
        });
    }
};
