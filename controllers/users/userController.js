const User = require('../../models/userSchema')
const env=require('dotenv').config();
const nodemailer=require('nodemailer')
const bcrypt = require('bcrypt')

// const securePassword = async (password) => {
//     try {
//         const passwordHash = await bcrypt.hash(password, 10)
//         return passwordHash;
//     } catch (error) {
//         console.log('Error hashing password:',error.message)
//     }
// } 

const loadRegister = async (req, res) => {
    try {
        return res.render('users/signup');

    } catch (error) {
        console.log('Home page not loading',error.message);
        res.status(500).send('Server error')
    }
}

function generateOtp(){
    return Math.floor(100000 + Math.random()*900000).toString()
}

async function sendVerificationEmail(email,otp){
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        });

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: 'Calliope - Verify Your Account',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333; text-align: center;">Welcome to Calliope!</h2>
                    <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px;">
                        <p style="font-size: 16px;">Your verification code is:</p>
                        <h1 style="color: #4CAF50; text-align: center; font-size: 36px; margin: 20px 0;">${otp}</h1>
                        <p style="font-size: 14px; color: #666;">This code will expire in 10 minutes.</p>
                    </div>
                    <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
                        If you didn't request this code, you can safely ignore this email.
                    </p>
                </div>
            `
        });
        
        console.log("Email sent successfully");
        return true;

    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
}

const insertUser = async (req, res) => {
    try {
        console.log('Request Body:', req.body);
        const {username,email, mobile,address,password, confirm_password} = req.body;
        
        if(password !== confirm_password) {
            return res.status(400).render('users/signup', {message: 'Passwords do not match'});
        }
        
        const findUser = await User.findOne({email});
        if(findUser) {
            return res.render('users/signup', {message: 'User with this email already exists'});
        }
        
        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);
        console.log('emailsent: ', emailSent);

        if(!emailSent) {
            return res.status(500).render('users/signup', {message: 'Failed to send verification email'});
        }

        // Store data in session
        req.session.userOtp = otp;
        req.session.userData = {username,email,password,mobile,address};
        
        console.log('OTP sent:', otp);
        return res.render('users/signup_verifyOTP', { email: email });
        
    } catch(error) {
        console.error('signup error', error);
        return res.status(500).render('users/signup', {message: 'An error occurred during signup'});
    }
};

const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10)
        return passwordHash;
    } catch (error) {
        console.error('Error hashing password:',error.message)
    }
}

const verifyOTP = async (req, res) => {
    try {
        const { otp } = req.body;
        console.log('Received OTP:', otp);
        console.log('Stored OTP:', req.session.userOtp);
        
        if(otp === req.session.userOtp) {
            const userData = req.session.userData;
            const spassword = await securePassword(userData.password);

            const saveUserData = new User({
                username: userData.username,
                email: userData.email,
                password: spassword,
                mobile: userData.mobile,
                address: userData.address,
                is_admin: 0
            });

            await saveUserData.save();
            
            // Clear sensitive data from session
            delete req.session.userOtp;
            delete req.session.userData;
            
            // Set user session
            req.session.user_id = saveUserData._id;
            
            res.json({
                success: true,
                message: 'Registration successful!',
                redirectUrl: '/user/login'
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Invalid OTP. Please try again.'
            });
        }
    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        });
    }
};

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
    verifyOTP,
    insertUser,
    loginLoad,
    verifyLogin,
    pageNotFound,
    loadHome,
    userLogout
}