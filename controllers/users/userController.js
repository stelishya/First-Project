const User = require('../../models/userSchema')
const bcrypt = require('bcrypt')

const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10)
        return passwordHash;
    } catch (error) {
        console.log('Error hashing password:',error.message)
    }
} 

const loadRegister = async (req, res) => {
    try {
        return res.render('users/signup');

    } catch (error) {
        console.log('Home page not loading',error.message);
        res.status(500).send('Server error')
    }
}

const insertUser = async (req, res) => {
    try {
        console.log('Request Body:',req.body);
        const {email,password,confirm_password}=req.body
        if(password !==confirm_password){
            return res.render('signup',{message:'passwords do not match'})
        }
        const findUser=await User.findOne
        // if (req.body.password !== req.body.confirm_password) {
        //     return res.status(400).render('users/signup', { message: 'Passwords do not match' });
        // }

        const spassword = await securePassword(req.body.password);
        const user = new User({username,email,mobile,password,address})
        // const user = new User({
        //     username: req.body.username,
        //     email: req.body.email,
        //     password: spassword,
        //     mobile: req.body.mobile,
        //     address:req.body.address,
        //     is_admin: 0,
        // });
        console.log('User Object:', user);
        const userData = await user.save(); // Mongoose will validate here

        if (userData) {
            return res.render("users/login", { message: "Registration successful! Please log in." });
        } else {
            return res.render("users/signup", { message: "Registration has failed" });
        }
    } catch (error) {
        console.error('error for save user\n',error.message);
        res.status(500).send('internal server error')
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
                console.log('Login successful!');
                return res.redirect('/user/home');// Redirect to home page after login
                
            } else {
                return res.render('users/login', { message: "Invalid email or password" });
            }
        }
        else {
            console.log('User not found');
            return res.render('users/login', { message: "User Not Found" });
        }

    }
    catch (error) {
        console.log('Error during login: ',error.message);
        res.status(500).send('Internal server error');
        return res.render('users/login', { message: "An error occurred. Please try again." });
    }
}
const pageNotFound= async (req,res)=>{
    try{
        res.status(404).render('layouts/404');
        // res.render('users/404')
    }
    catch(error){
        console.error(error)
        res.redirect('/pageNotFound')
    }
}

const loadHome = async (req, res) => {
    try {
        const session=req.session.user;
        const title='CAlliope';
        // const userGreet=req.session.user ? session.username || session.
        // console.log('welcome to home page!')
        const userData = await User.findOne({ _id:req.session.user_id })
        // console.log(userData)
        return res.render('users/Lhome',{ user:userData });
    } catch (error) {
        console.log('Home Page Not Found',error.message);
        res.status(500).send('Server Error')
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
    pageNotFound,
    loadHome,
    userLogout
}