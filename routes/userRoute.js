const express=require("express")
const user_route =express();
// const session = require('express-session');
// const auth = require('../middleware/auth'); // Add middleware reference
// const bodyParser=require('body-parser')
const config = require('../config/config');
const userController =require("../controllers/users/userController");

// user_route.use(session({
//     secret:config.sessionSecret, 
//     resave: false, 
//     saveUninitialized: true,
//     cookie: { secure: false }  // Set to true when using HTTPS
// }));

// user_route.set('views','./views/users');

// user_route.use(bodyParser.json());
// user_route.use(bodyParser.urlencoded({extended:true}));



user_route.get('/signup',userController.loadRegister);

user_route.post("/signup",userController.insertUser);

// OTP Verification routes
user_route.post('/verifyOTP',userController.verifyOTP);
user_route.post('/resendOTP',userController.resendOTP);

// user_route.get("/",userController.loginLoad);
user_route.get('/login',userController.loginLoad);
user_route.post('/login',userController.verifyLogin);

user_route.get('/home',userController.loadHome);

user_route.get('/logout',userController.userLogout);

user_route.use('*', userController.pageNotFound);

module.exports =user_route;