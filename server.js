const express= require("express"); 
const session = require('express-session');
// const env=require('dotenv').config();
const ejs = require('ejs')
const path=require('path');
const nocache = require('nocache');
const bodyParser=require('body-parser')
// const db=require('./config/db')
// db()

const userRoute=require('./routes/userRoute');//import userRoute
const adminRoute=require('./routes/adminRoute');//import adminRoute

const app=express();

const mongoose=require("mongoose");
const { db } = require("./models/userSchema");
mongoose.connect("mongodb://127.0.0.1:27017/mydatabase");
 
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));
// app.use(session({
//     secret: process.env.SECRET,
//     resave: false,
//     saveUninitialized: true
//     cookie: { 
//     secure: false,
//     httpOnly:true
//     maxAge:72*60*60*1000
//     } 
// }));

// app.use(session({
//     secret:config.sessionSecret, 
//     resave: false, 
//     saveUninitialized: true,
//     cookie: { secure: false }  // Set to true when using HTTPS
// }));
app.use((req,res,next)=>{
    res.set('cache-control','no-store')
    next()
})



app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')))
// app.set('views', [path.join(__dirname, 'views/user'),path.join(__dirname, 'views/admin')]);

app.use(nocache()); //prevents caching

//for user routes
app.use('/user',userRoute);
// app.use('/', userRoute);

//for admin routes
app.use('/admin',adminRoute);


app.listen(4000,function(){
    console.log("Server is running at port 4000")
});




// const port=process.env.PORT || 4000;
// const dbUrl=process.env.DATABASE_URL;
// const secretKey=process.env.SECRET;
// const password=process.env.PASSWORD
// const email=process.env.EMAIL
// console.log(port,dbUrl,email,password,secretKey)

// app.use(session({
//     secret: process.env.SECRET,
//     resave: false,
//     saveUninitialized: true
// }));

// const port = process.env.PORT