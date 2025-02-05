const express=require("express")
const user_route =express.Router();
const  { userAuth,adminAuth}=require('../middlewares/auth')

const userController =require("../controllers/userController");
const productController = require('../controllers/productController')
const addressController = require('../controllers/addressController')
const cartController = require('../controllers/cartController')
const orderController = require('../controllers/orderController')
const paymentController = require('../controllers/paymentController');
const couponController = require('../controllers/couponController');
const wishlistController = require('../controllers/wishlistController');
const walletController = require('../controllers/walletController');


const User = require('../models/userSchema')

const passport = require('passport')

user_route.use('/',express.static('public'));

user_route.get('/signup',userController.loadRegister);
user_route.post("/signup",userController.insertUser);
user_route.post('/verifyOTP',userController.verifyOTP);
user_route.post('/resendOTP',userController.resendOTP);
user_route.get('/auth/google',passport.authenticate('google',{scope:['profile','email'],prompt: 'select_account'}));
user_route.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/user/signup'}),async (req,res)=>{
    try {
        if (req.isAuthenticated() && req.user) {
            const {user}= req.user;
            // const googleId = req.user.googleId;
            // const user= await User.findOne({googleId}).lean();
            if(user){
                req.session.user = user;
                // req.session.save();
                res.redirect('/user/home');
            }else{
                res.redirect('/user/login');
            }
        } else {
            console.log('Authentication failed, redirecting to signup.');
            res.redirect('/user/signup');
        }
    } catch (error) {
        console.error('Google authentication error:', error);
        res.status(500).send('Google authentication failed');
    }
});

// user_route.get("/",userController.loginLoad);
user_route.get('/login',userController.loginLoad);
user_route.post('/login',userController.verifyLogin);
user_route.get('/forgotPassword',userController.forgotPasswordPage)
// user_route.post('/sendOtp',userController.sendOtp)

//Home page 
user_route.get('/demo',userAuth,(req,res)=>{res.render('users/home')});
user_route.get('/home',userAuth,userController.loadHome);
user_route.get('/logout',userController.userLogout);

//Products
user_route.get('/products',userAuth,productController.showProductsPage)
user_route.get('/api/products', userAuth,productController.fetchProducts);
user_route.get('/product/details/:productId',userAuth, productController.productDetailsUser)

// Profile
user_route.post('/forgot-password',userController.forgotPasswordPage)
user_route.get('/reset-password', (req, res) => {
    const token  = req.query.token; // Extract the reset token from the query string
    res.render('users/login', { token }); // Render a page with the token
});
user_route.post('/reset-password', userController.resetPassword);
user_route.get('/dashboard',userAuth,userController.dashboard)
user_route.post('/dash/saveUserDetails',userController.saveUserDetails)
user_route.post('/changePassword',userController.changePassword)
user_route.delete('/deleteAccount/:userId', userController.deleteAccount)

//Address
user_route.get('/showUserAddresses',addressController.showUserAddresses)
user_route.post('/addAddress',addressController.addAddress)
user_route.patch('/editAddress/:addressId',addressController.editAddress)
user_route.delete('/deleteAddress/:addressId',addressController.deleteAddress)

// Cart 
user_route.get('/cart', userAuth, cartController.getCart);
user_route.post('/addToCart', userAuth, cartController.addToCart);
user_route.post('/cart/updateQuantity', userAuth, cartController.updateQuantity);
user_route.delete('/cart/removeProduct', userAuth, cartController.removeProduct);

// Orders
user_route.get('/checkout', userAuth, orderController.checkout)
user_route.post('/checkout', userAuth, orderController.checkout)
user_route.post('/order/creation',orderController.orderCreation)
user_route.get('/orders',userAuth,orderController.showOrdersUser)
user_route.get('/order/details/:orderId',userAuth,orderController.orderDetailsUser)
user_route.get('/order/invoice/:orderId',userAuth,orderController.downloadInvoice)
user_route.patch('/order/cancel/:orderId',userAuth,orderController.cancelOrder)
user_route.post('/order/return/:orderId',userAuth,orderController.returnOrder)

//RazorPay Payment
user_route.post('/create-order', userAuth, paymentController.createOrder);
user_route.post('/verify-payment', userAuth, paymentController.verifyPayment);
user_route.post('/retry-payment', userAuth, paymentController.retryPayment)
user_route.post('/verify-retry-payment', userAuth, paymentController.verifyRetryPayment)

//Coupon
user_route.get('/available-coupons', userAuth, couponController.getAvailableCoupons);
user_route.post('/apply-coupon', userAuth, couponController.applyCoupon);
user_route.post('/remove-coupon', userAuth, couponController.removeCoupon);

//Wishlist
user_route.get('/wishlist', userAuth, wishlistController.getWishlist);
user_route.post('/wishlist/add', userAuth, wishlistController.addToWishlist);
user_route.post('/wishlist/remove', userAuth, wishlistController.removeFromWishlist);
user_route.get('/wishlist/check/:productId', userAuth, wishlistController.checkWishlist);

// Wallet
user_route.get('/wallet',userAuth, walletController.walletPage);
user_route.post('/wallet/add-money',userAuth, walletController.addMoneyToWallet);
user_route.get('/wallet/balance',userAuth, walletController.getWalletBalance);

user_route.get('/pageNotFound',userController.pageNotFound);
user_route.post("/order/create",(req,res)=>{
    console.log("heyyyy");
    
})

module.exports =user_route;