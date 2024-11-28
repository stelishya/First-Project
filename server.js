const express = require('express')
const config = require('./config')
const path = require('path')
const session = require('express-session')

// Load environment variables at the very beginning
require('dotenv').config({ path: path.resolve(__dirname, '.env') })

// Check if email credentials are loaded
console.log('Email configured for:', process.env.NODEMAILER_EMAIL ? process.env.NODEMAILER_EMAIL : 'NOT SET');

const app = express()
const db = require('./config/db')

// console.log('Configuration loaded:', config)

const port = config.PORT || 4000

// Set up middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up session middleware
app.use(session({
    secret: 'your-secret-key',  // Change this to a secure secret
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }  // Set to true if using HTTPS
}));

// Set up view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files - make sure this comes before routes
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/', express.static(path.join(__dirname, 'public')));

// Connect to database
db()

// Import user routes
const userRoute = require('./routes/userRoute');

// Mount user routes
app.use('/user', userRoute);

app.listen(port, () => {
    console.log(`Server is running at port ${port}`)
})

module.exports = app