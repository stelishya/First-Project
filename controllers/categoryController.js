const Category = require('../models/categorySchema');
const Product = require('../models/productSchema');

exports.categoryInfo = async(req,res)=>{
    try {
        const {offer} = req.body;
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;

        const categoryData = await Category.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCategories = await Category.countDocuments();
        const totalPages = Math.ceil(totalCategories / limit);

        let adminName = "Admin"; // Default admin name
        if (req.userId) { // Check if userId is available in the request
            const admin = await User.findById(req.userId);
            if (admin && admin.name) {
                adminName = admin.name;
            }
        }
        // const adminName = req.session.adminName || "Admin";

        res.render("admin/category",{
            title: 'Category Management',
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories,
            adminName:adminName,
            categoryOffer: offer || 0,
            // discountTypes: ['Percentage Discount', 'Fixed Amount'],
            path: '/admin/category'
        });
        
    } catch (error) {
        console.error('error in categoryInfo : ',error);
        res.redirect('pageError')
    }
}

exports.addCategory = async(req,res)=>{
    const {name, description, offer} = req.body;
    try {
        // Validate required fields
        if (!name || !description) {
            return res.status(400).json({
                success: false,
                message: 'Name and description are required'
            });
        }

        // Trim and convert name to lowercase for comparison
        const normalizedName = name.trim().toLowerCase();

        // Check for existing category (case-insensitive)
        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${normalizedName}$`, 'i') }
        });

        if (existingCategory) {
            console.log('Category exists:', existingCategory); // Debug log
            return res.status(400).json({
                success: false,
                message: `Category "${name}" already exists`
            });
        }

        // Create new category
        const newCategory = new Category({
            name: name.trim(), // Store trimmed name
            description: description.trim(),
            categoryOffer: offer || 0
        });
        
        await newCategory.save();
        console.log('New category created:', newCategory); // Debug log

        // Send success response
        return res.status(200).json({
            success: true,
            message: 'Category added successfully',
            category: newCategory
        });

    } catch (error) {
        console.error('Error adding category:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while adding the category',
            error: error.message
        });
    }
}

// exports.addCategoryOffer = async (req,res)=>{
//     try {
//         const percentage = parseInt(req.body.percentage);
//         const categoryId = req.body.categoryId;
    
//         const category = await Category.findById(categoryId);
//         if (!category) {
//             return res.status(404).json({ status: false, message: "Category not found" });
//         }
    
//         const products = await Product.find({ category: category.id });
//         const hasProductOffer = products.some((product) => product.productOffer > percentage);
//         if (hasProductOffer) {
//             return res.json({ status: false, message: "Products within this category already have product offers" });
//         }
    
//         await Category.updateOne({ _id: categoryId }, { $set: { categoryOffer: percentage } });
    
//         for (const product of products) {
//             product.productOffer = 0;
//             product.salePrice = product.regularPrice;
//             await product.save();
//         }
//         // const adminName = req.session.adminName || "Admin";

//         return res.json({ status: true, message: "Category offer updated successfully"});
//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({ status: false, message: "Internal server error" });
//     }


// }

// exports.removeCategoryOffer = async (req,res)=>{
//     try {
//         const categoryId = req.body.categoryId;
    
//         const category = await Category.findById(categoryId);
//         if (!category) {
//             return res.status(404).json({ status: false, message: "Category not found" });
//         }
//         const percentage = category.categoryOffer;

//         const products = await Product.find({ category: category._id });
    
//         if (products.length > 0) {
//             for (const product of products) {
//                 product.salePrice += Math.floor(product.regularPrice * (percentage / 100));
//                 product.productOffer = 0;
//                 await product.save();
//             }
//         }
//         category.categoryOffer = 0;
//         await category.save();
//         return res.json({ status: true });
//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({ status: false, message: "Internal server error" });
//     }
// }

exports.getListCategory = async(req,res)=>{
    try {
        let id = req.query.id;
        await Category.updateOne({_id:id},{$set:{isListed:false}});
        res.redirect("/admin/category")
    } catch (error) {
        console.error(error);
        res.redirect("/pageError");
    }
}

exports.getUnlistCategory = async(req,res)=>{
    try {
        let id = req.query.id;
        await Category.updateOne({_id:id},{$set:{isListed:true}});
        res.redirect("/admin/category")
    } catch (error) {
        console.error(error);
        res.redirect("/pageError");
    }
}

exports.getEditCategory = async(req,res)=>{
    try {
        const {offer} = req.body;
        let id = req.query.id;
        const category = await Category.findOne({_id:id});

        if (!category) {
            return res.redirect('/admin/category');
        }
        res.render("admin/edit-category",{
            title: 'Edit Category',
            category:category,
            categoryOffer: offer || 0,
            // discountTypes: ['Percentage Discount', 'Fixed Amount'] ,
            path: '/admin/category'  
            });
    } catch (error) {
        console.error('Error in getEditCategory:',error);
        res.redirect("pageError");
    }
}

exports.editCategory = async (req, res) => {
    try {
        const id = req.params.id;
        const { category: categoryName, description,  offer } = req.body;
        
        const existingCategory = await Category.findOne({ 
            name: categoryName,
            _id: { $ne: id } // Exclude current category from duplicate check
        });

        if (existingCategory) {
            return res.status(400).json({ error: "Category exists, please choose another name" });
        }

        const updateData = {
            name: categoryName,
            description: description,
            categoryOffer: offer || 0
        };

        // // Add offer details if provided
        // if (discountType === 'Percentage Discount' && offer) {
        //     updateData.categoryOffer = offer;
        //     updateData.fixedAmount = null;
        // }
        // } else if (discountType === 'Fixed Amount' && fixedAmount) {
        //     updateData.categoryOffer = null;
        //     updateData.fixedAmount = fixedAmount;
        // }

        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        );

        if (updatedCategory) {
            res.redirect("/admin/category");
        } else {
            res.status(404).json({ error: "Category not found" });
        }
    } catch (error) {
        console.error('Error in editCategory:', error);
        res.status(500).json({ error: "Internal server error" });
    }
}

// exports.editCategory= async (req,res)=>{
//     try {
//         const id = req.params.id;
//         const {category,description} = req.body;
//         const existingCategory = await Category.findOne({name:categoryName});

//         if(existingCategory){
//             return res.status(400).json({error:"Category exists, please choose another name"})
//         }
//         const updateCategory = await category.findByIdandUpdate(id,{
//             name:categoryName,
//             description:description
//         },{new:true});

//         if(updateCategory){
//             res.redirect("/admin/category");
//         }else{
//             res.status(404).json({error:"Category not found"})
//         }
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({error:"Internal server error" })
//     }
// }