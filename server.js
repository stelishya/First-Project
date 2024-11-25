const express= require("express"); 
const app=express();
const ejs = require('ejs')
const path=require('path');
const nocache = require('nocache');

const mongoose=require("mongoose");
mongoose.connect("mongodb://127.0.0.1:27017/mydatabase");
 
app.use(express.static('public'))
app.set('view engine', 'ejs');
// app.set('views', path.join(__dirname, 'views'));

app.use(nocache()); //prevents caching

//for user routes
const userRoute=require('./routes/userRoute');//import userRoute
app.use('/user',userRoute);
app.use('/', userRoute);

//for admin routes
const adminRoute=require('./routes/adminRoute');//import adminRoute
app.use('/admin',adminRoute);


app.listen(4000,function(){
    console.log("Server is running at port 4000")
});


// const env=require('dotenv').config();
// console.log('Environment Variables:', process.env);


// const db=require('./config/db')
// db()

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


// const ejs = require('ejs')
// const nocache = require('nocache');

// const mongoose=require("mongoose");
// mongoose.connect("mongodb://127.0.0.1:27017/mydatabase");

// app.use(express.static('public'))
// app.set('view engine', 'ejs');

// app.use(nocache());

// const userRoute=require('./routes/userRoute');
// app.use('/user',userRoute);

// const adminRoute=require('./routes/adminRoute');
// app.use('/admin',adminRoute);
// const port = process.env.PORT