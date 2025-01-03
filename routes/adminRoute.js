const express = require("express");
const admin_route = express.Router();

const adminController = require("../controllers/adminController");
const customerController = require("../controllers/customerController");
const categoryController = require("../controllers/categoryController")
const productController = require("../controllers/productController")
const orderController = require("../controllers/orderController")
const couponController = require('../controllers/couponController');
const Coupon = require('../models/couponSchema');

const bodyParser = require("body-parser");
const Category = require("../models/categorySchema");

admin_route.use(bodyParser.json());
admin_route.use(bodyParser.urlencoded({ extended: true }));

// admin_route.set('views','./views/admin');

// const auth = require('../middleware/adminAuth'); 


// admin_route.get('/',adminController.loadLogin);

//Login management
admin_route.get('/pageError', adminController.pageError);
admin_route.get('/login', adminController.loadLogin);
admin_route.post('/login', adminController.login)
admin_route.get('/dashboard', adminController.loadDashboard);
// adminAuth,
admin_route.get('/logout', adminController.logout);

//Customer Management
admin_route.get('/users', customerController.customerInfo);
admin_route.get('/blockCustomer', customerController.blockCustomer)
admin_route.get('/unblockCustomer', customerController.unblockCustomer)

//Category Management
admin_route.get('/category', categoryController.categoryInfo)
admin_route.post('/addCategory', categoryController.addCategory)
admin_route.get('/listCategory', categoryController.getListCategory)
admin_route.get('/unlistCategory', categoryController.getUnlistCategory)
admin_route.get('/editCategory', categoryController.getEditCategory)
admin_route.post('/editCategory/:id', categoryController.editCategory)


// Product Management
admin_route.get('/products', productController.products);
admin_route.get('/products/add', productController.addProductPage);
admin_route.post('/products/add', productController.addProduct);
admin_route.patch('/products/:action/:id', productController.list_unlist);
admin_route.get('/products/edit/:id', productController.editPage);
admin_route.post('/products/edit/:id', productController.edittingProduct);
admin_route.get('/products/view/:id', productController.productDetails);

// Orders
admin_route.get('/orders',orderController.getOrdersAdmin)
admin_route.post('/cancelOrder/:orderId',orderController.cancelOrder)
admin_route.patch('/updateOrderStatus/:orderId',orderController.updateStatus)

//Coupon Management
admin_route.get('/coupons',couponController.getAllCoupons);
admin_route.post('/coupons', couponController.createCoupon);
admin_route.patch('/coupons/:id/toggle-status',couponController.couponStatus);
admin_route.post('/admin/coupon/edit/:id', couponController.editCoupon);


module.exports = admin_route;