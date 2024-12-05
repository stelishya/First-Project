const express=require("express")
const user_route =express.Router();
const passport = require('passport')
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

//Home page and shopping page
user_route.get('/home',userController.loadHome);

user_route.get('/logout',userController.userLogout);

user_route.get('/pageNotFound',userController.pageNotFound);

module.exports =user_route;