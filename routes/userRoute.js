const express=require("express")
const user_route =express.Router();
const  { userAuth,adminAuth}=require('../middlewares/auth')
const userController =require("../controllers/users/userController");
const productController = require('../controllers/admin/productController')
const passport = require('passport')

user_route.use('/',express.static('public'));


// Sign up management
user_route.get('/signup',userController.loadRegister);
user_route.post("/signup",userController.insertUser);
user_route.post('/verifyOTP',userController.verifyOTP);// OTP Verification routes
user_route.post('/resendOTP',userController.resendOTP);
user_route.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
user_route.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    res.redirect('/user/home')
});

// user_route.get("/",userController.loginLoad);
user_route.get('/login',userController.loginLoad);
user_route.post('/login',userController.verifyLogin);
user_route.get('/forgotPassword',userController.forgotPasswordPage)
user_route.post('/sendOtp',userController.sendOtp)

//Home page 
user_route.get('/home',userController.loadHome);
user_route.get('/logout',userController.userLogout);

//Products
user_route.get('/products',productController.showProductsPage)
user_route.get('/product/details/:productId', productController.productDetails)

// Profile
user_route.get('/dashboard',userAuth,userController.dashboard)
user_route.post('/dash/saveUserDetails',userController.saveUserDetails)
user_route.post('/changePassword',userController.changePassword)

user_route.get('/pageNotFound',userController.pageNotFound);

module.exports =user_route;