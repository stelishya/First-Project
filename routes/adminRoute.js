const express = require('express');
const admin_route =express.Router();

const adminController =require("../controllers/admin/adminController");
const customerController =require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController")
const productController = require("../controllers/admin/productController")
const bodyParser = require("body-parser");


admin_route.use(bodyParser.json());
admin_route.use(bodyParser.urlencoded({extended:true}));

// admin_route.set('views','./views/admin');

// const auth = require('../middleware/adminAuth'); 


// admin_route.get('/',adminController.loadLogin);

//Login management
admin_route.get('/pageError',adminController.pageError);
admin_route.get('/login',adminController.loadLogin);
admin_route.post('/login',adminController.login)
admin_route.get('/dashboard',adminController.loadDashboard);
// adminAuth,
admin_route.get('/logout',adminController.logout);

//Customer Management
admin_route.get('/users',customerController.customerInfo);
admin_route.get('/blockCustomer',customerController.blockCustomer)
admin_route.get('/unblockCustomer',customerController.unblockCustomer)

//Category Management
admin_route.get('/category',categoryController.categoryInfo)
admin_route.post('/addCategory',categoryController.addCategory)
admin_route.post('/addCategoryOffer',categoryController.addCategoryOffer)
admin_route.post('/removeCategoryOffer',categoryController.removeCategoryOffer)
admin_route.get('/listCategory',categoryController.getListCategory)
admin_route.get('/unlistCategory',categoryController.getUnlistCategory)
admin_route.get('/editCategory',categoryController.getEditCategory)
admin_route.post('/editCategory/:id',categoryController.editCategory)


// Product Management
admin_route.get('/products',productController.products)
admin_route.get('/products/add',productController.addProductPage)
admin_route.post('/products/add',productController.addProduct)
admin_route.post('/listProduct',productController.list_unlist)
admin_route.get('/deleteProduct',productController.deleteProduct)
admin_route.get('/editProduct',productController.editPage)
admin_route.post('/editProduct',productController.edittingProduct)
admin_route.get('/viewProduct',productController.productDetails)



// admin_route.get('/addProducts',productController.getProductAddPage)
// adminAuth,









// admin_route.post('/addProducts',uploads.array("images",4),productController.addProducts);
// adminAuth,


module.exports =admin_route;