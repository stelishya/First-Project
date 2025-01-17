const express = require('express')
require('dotenv').config();
const config = require('./config/config')
const path = require('path')
const session = require('express-session')
const passport = require('./config/passport')
const nocache = require('nocache')
const db = require('./config/db')
const expressLayouts = require('express-ejs-layouts')
const userRoute = require('./routes/userRoute');
const adminRoute = require('./routes/adminRoute');
const  { userAuth,adminAuth}=require('./middlewares/auth')
db()  

const app = express()

const port = config.PORT || 4000


app.use(express.json({limit: '10mb'}));
app.use(express.urlencoded({ extended: true, limit: '10mb' })); 

app.use(session({
    secret: config.SECRET,  
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false, 
        httpOnly:true,
        maxAge:72*60*60*1000
    }  
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(nocache())
app.use((req,res,next)=>{
    res.set('cache-control','no-store');
    next();
})

// Set up view engine and layouts
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static('uploads'));


app.use('/user', userRoute);
app.use('/admin',adminAuth,adminRoute)


app.listen(port, () => {
    console.log(`Server is running at port ${port}`)
})

module.exports = app;