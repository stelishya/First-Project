const user = require('../models/userModel')
const bcrypt = require('bcrypt')

const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10)
        return passwordHash;
    } catch (error) {
        console.log(error.message)
    }
} 

const loadRegister = async (req, res) => {
    try {
        return res.render('users/signup');

    } catch (error) {
        console.log(error.message);
    }
}

const insertUser = async (req, res) => {
    try {
        console.log(req.body);
        const spassword = await securePassword(req.body.password);

        const user = new User({
            username: req.body.username,
            email: req.body.email,
            password: spassword,
            mobile: req.body.mobile,
            address:req.body.address,
            is_admin: 0,
        });

        const userData = await user.save(); // Mongoose will validate here

        if (userData) {
            return res.render("users/login", { message: "Registration successful! Please log in." });
        } else {
            return res.render("users/signup", { message: "Registration has failed" });
        }
    } catch (error) {
        console.log(error.message);
        return res.render("users/signup", { message: "Error occurred during registration" });
    }
}

//Login user methods started
const loginLoad = async (req, res) => {
    try {
        return res.render('users/login', { message: null });
    } catch (error) {
        console.log(error.message);
    }
}

const verifyLogin = async (req, res) => { 
    try {
        const email = req.body.email;
        const password = req.body.password;

        const userData = await User.findOne({ email: email });

        if(userData) {
            const passwordMatch = await bcrypt.compare(password, userData.password);
            if (passwordMatch) {
                req.session.user_id = userData._id; // Set session after successful login
                req.session.username= userData.username;
                return res.redirect('/user/home');// Redirect to home page after login
                
            } else {
                return res.render('users/login', { message: "Invalid email or password" });
            }
        }
        else {
            return res.render('users/login', { message: "User Not Found" });
        }

    }
    catch (error) {
        console.log(error.message);
        return res.render('users/login', { message: "An error occurred. Please try again." });
    }
}

const loadHome = async (req, res) => {
    
    try {
        const userData = await User.findOne({ _id:req.session.user_id })
        console.log(userData)
        return res.render('users/home',{ user:userData });
    } catch (error) {
        console.log(error.message);
    }
}

const userLogout = async(req,res)=>{
    try {
        req.session.user_id=null;
        return res.redirect('/user/login');

    }catch(error){
        console.log(error.message);
    }
}

module.exports = {
    loadRegister,
    insertUser,
    loginLoad,
    verifyLogin,
    loadHome,
    userLogout
}