const Category = require('../models/categorySchema');
const Product = require('../models/productSchema');

exports.categoryInfo = async(req,res)=>{
    try {
        let search = req.query.search || '';
        const {offer} = req.body;
        const page = parseInt(req.query.page) || 1;
        const limit = 7;
        const skip = (page - 1) * limit;

        const categoryData = await Category.find({
            name: { $regex: new RegExp(search, 'i') }
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCategories = await Category.countDocuments({ name: { $regex: new RegExp(search, 'i') }});
        const totalPages = Math.ceil(totalCategories / limit);

        let adminName = "Admin"; 
        if (req.userId) { 
            const admin = await User.findById(req.userId);
            if (admin && admin.name) {
                adminName = admin.name;
            }
        }
        // const adminName = req.session.adminName || "Admin";

        res.render("admin/category",{
            title: 'Category Management',
            search,
            cat: categoryData,
            currentPage: page,
            totalPages,
            limit,
            totalCategories: totalCategories,
            adminName:adminName,
            categoryOffer: offer || 0,
            // discountTypes: ['Percentage Discount', 'Fixed Amount'],
            path: '/admin/category',
            activeTab: 'categories'
        });
        
    } catch (error) {
        console.error('error in categoryInfo : ',error);
        res.redirect('pageError')
    }
}

exports.addCategory = async(req,res)=>{
    const {name, description, offer} = req.body;
    try {
        if (!name || !description) {
            return res.status(400).json({
                success: false,
                message: 'Name and description are required'
            });
        }

        // const normalizedName = name.trim().toLowerCase();
        // console.log('normalizedName', normalizedName)
        const existingCategory = await Category.findOne({
            name: { $regex: `^${name}$`,$options: 'i' }
        });
        console.log('existingCategory', existingCategory)
        if (existingCategory) {
            console.log('Category exists:', existingCategory);
            return res.status(400).json({
                success: false,
                message: `Category already exists`
            });
        }

        const newCategory = new Category({
            name: name.trim(), 
            description: description.trim(),
            categoryOffer: offer || 0
        });
        console.log('newCategory', newCategory)
        await newCategory.save();
        console.log('New category created:', newCategory); 

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




exports.getListCategory = async(req,res)=>{
    try {
        let id = req.query.id;
        await Category.updateOne({_id:id},{$set:{isListed:false}});
        res.json({
            success:true,
            message: 'Category unlisted successfully'
        })
        // res.redirect("/admin/category")
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to unlist category'
        });
        // res.redirect("/pageError");
    }
}

exports.getUnlistCategory = async(req,res)=>{
    try {
        let id = req.query.id;
        await Category.updateOne({_id:id},{$set:{isListed:true}});
        res.json({
            success: true,
            message: 'Category listed successfully'
        });
        // res.redirect("/admin/category")
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to list category'
        });
        // res.redirect("/pageError");
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
            path: '/admin/category',
            activeTab: 'categories'
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
            _id: { $ne: id } 
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

