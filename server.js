const express = require('express')
require('dotenv').config();
const config = require('./config/config')
const path = require('path')
const session = require('express-session')
const passport = require('./config/passport')
const db = require('./config/db')
const userRoute = require('./routes/userRoute');// Import user routes
const adminRoute = require('./routes/adminRoute');// Import admin routes

db()    // Connect to database

const app = express()

console.log('Environment Check:', {
    email: process.env.NODEMAILER_EMAIL ? 'Set' : 'Not Set',
    password: process.env.NODEMAILER_PASSWORD ? 'Set' : 'Not Set',
    port: process.env.PORT
});
// Check if email credentials are loaded
console.log('Email configured for:', process.env.NODEMAILER_EMAIL ? process.env.NODEMAILER_EMAIL : 'NOT SET');

const port = config.PORT || 4000

// Set up middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Set up session middleware
app.use(session({
    secret: config.SECRET,  // Change this to a secure secret
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false, // Set to true if using HTTPS
        httpOnly:true,
        maxAge:72*60*60*1000
    }  
}));

app.use(passport.initialize());
app.use(passport.session());

app.use((req,res,next)=>{
    res.set('cache-control','no-store');
    next();
})

// Set up view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
//app.set('views', [path.join(__dirname, 'views/user'),path.join(__dirname, 'views/admin')]);
app.use(express.static(path.join(__dirname, 'public')));
app.set('layout', 'layouts/main');

app.use('/user', userRoute);
app.use('/admin',adminRoute)

app.listen(port, () => {
    console.log(`Server is running at port ${port}`)
})

module.exports = app