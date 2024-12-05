const express = require('express');
const admin_route =express.Router();
const adminController =require("../controllers/admin/adminController");
const customerController =require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController")
const bodyParser = require("body-parser");
const  { userAuth,adminAuth}=require('../middlewares/auth')

// const session = require('express-session');
// const config = require('../config/config');
// admin_route.use(session({
//     secret:config.sessionSecret,
//     resave: false,// Don't save unmodified session
//     saveUninitialized: true,//sessions won't be created until the session has data.
//     cookie: { secure: false } // Set to true when using HTTPS
// }));

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
// adminAuth,
admin_route.get('/blockCustomer',customerController.blockCustomer)
// adminAuth,
admin_route.get('/unblockCustomer',customerController.unblockCustomer)
// adminAuth,

//Category Management
admin_route.get('/category',categoryController.categoryInfo)
// adminAuth,
admin_route.post('/addCategory',categoryController.addCategory)
// adminAuth,
admin_route.post('/addCategoryOffer',categoryController.addCategoryOffer)
// adminAuth,
admin_route.post('/removeCategoryOffer',categoryController.removeCategoryOffer)
// adminAuth,
admin_route.get('/listCategory',categoryController.getListCategory)
// adminAuth,
admin_route.get('/unlistCategory',categoryController.getUnlistCategory)
// adminAuth,
admin_route.get('/editCategory',categoryController.getEditCategory)
// adminAuth,

module.exports =admin_route;