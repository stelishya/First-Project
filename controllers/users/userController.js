// require('dotenv').config();
const User = require('../../models/userSchema')
const nodemailer=require('nodemailer')
const bcrypt = require('bcrypt');
const { read } = require('fs');

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
        // Debug logging
        console.log('Email Config:', {
            email: process.env.NODEMAILER_EMAIL,
            emailPass: process.env.NODEMAILER_PASSWORD,
            hasPassword: !!process.env.NODEMAILER_PASSWORD
        });
        if (!process.env.NODEMAILER_EMAIL || !process.env.NODEMAILER_PASSWORD) {
            console.error('Missing email configuration in environment variables');
            return false;
        }
          // Configure Nodemailer for Gmail
        const transporter = nodemailer.createTransport({
            port: 587,
            secure: false, 
            service:'gmail',
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            },
            tls: {
                rejectUnauthorized: false  // Accept self-signed certificates
            }
        });

        const mailOptions = {
            from: {
                name: 'Calliope',
                address: process.env.NODEMAILER_EMAIL  // Sender's email
            },
            to: email,                          // Receiver's email
            subject: 'Email Verification - Calliope',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333; text-align: center;">Email Verification</h2>
                    <p style="color: #666;">Your verification code is:</p>
                    <h1 style="text-align: center; color: #4CAF50; font-size: 36px; letter-spacing: 5px;">${otp}</h1>
                    <p style="color: #666;">This code will expire in 3 minutes.</p>
                    <p style="color: #666;">If you didn't request this code, please ignore this email.</p>
                </div>
            `
        };

        // Verify connection configuration
        await transporter.verify();
        console.log('Transporter verified successfully');

        const info = await transporter.sendMail(mailOptions);
        if (info && info.response) {
            console.log("Email sent: ", info.response); // Logs the email sending status
            return true;  // Email sent successfully
        } else {
            console.error("Error: No response from email transporter");
            return false; // Failure in sending email
        }
    } catch (error) {
        console.error('Error sending email:', error);
        console.error('Error details:', {
            code: error.code,
            command: error.command,
            response: error.response
        });
        return false;
    }
}

const insertUser = async (req, res) => {
    try {
        console.log('Request Body:', req.body);
        const {username,email,language, mobile,password, confirm_password} = req.body;
        
        if(password !== confirm_password) {
            return res.status(400).render('users/signup', {message: 'Passwords do not match'});
        }
        
        const findUser = await User.findOne({email});
        if(!findUser){
            const newuser = new User({
                username:username,
                password:await bcrypt.hash(req.body.password,10),// Hashing password for security
                email:email,
                mobile:mobile,
                language:language,
                createdAt: new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})
            });
            // save the new user
            await newuser.save();
            console.log("User saved successfully");

        
        // if(findUser) {
        //     return res.render('users/signup', {message: 'User with this email already exists'});
        // }
        //generate otp
        const otp = generateOtp();
       
            try {
                await sendVerificationEmail(email, otp)
                req.session.otp_cred = email;
                req.session.otp= parseInt(otp);
                req.session.otpExpires = Date.now() + 10 * 60 * 1000; // 10-min expiration
                console.log(`generated OTP : ${otp}`);
                console.log('OTP sent successfully')
            } catch (error) {
                console.error('Error sending OTP email',error)
            }
        console.log("Email:", email);
        // Redirect to OTP page
        return res.render('users/verifyOTP_signup',{email})
    }else{
        req.session.signUp_msg = "User already exists"
            console.error('user already exists');
            res.redirect('/user/login'); // User already exists
    }
        // console.log('emailsent: ', emailSent);

        // if(!emailSent) {
        //     return res.status(500).render('users/signup', {message: 'Failed to send verification email'});
        // }

        // Store data in session
        // req.session.otp = otp;
        // req.session.tempUserData = {username,email,password,mobile,address};
        
        // console.log('OTP sent:', otp);
        // return res.render('users/signup_verifyOTP', { email: email });
        
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
        const submittedOTP = parseInt(req.body.otp.join(''));
        console.log(submittedOTP)
        if(req.session.otp === submittedOTP && req.session.otpExpires > Date.now()){
            console.log('req.session.otp : ',req.session.otp)
            req.session.otp=null;
            req.session.otpExpires=null;

            await User.findOneAndUpdate({email:req.session.otp_cred}, {is_verified:true})
            res.redirect('/user/login');
        }else if(req.session.otpExpires < Date.now()){
            res.status(400).json("OTP Expired")
        }else{
            res.status(400).json("Invalid OTP")
        }
        
    } catch (error) {
        console.error('Error in verifying OTP: ',error)
        res.status(500).send('Server error');
    }
    // try {
    //     const { otp,password} = req.body;
    //     const storedOTP = req.session.otp;
    //     const userData = req.session.tempUserData;

    //     if (!storedOTP || !userData) {
    //         return res.status(400).json({
    //             success: false,
    //             message: "OTP session expired. Please try signing up again."
    //         });
    //     }

    //     if (otp !== storedOTP) {
    //         return res.status(400).json({
    //             success: false,
    //             message: "Invalid OTP. Please try again."
    //         });
    //     }
    //      // Validate that a password is provided
    //      if (!password) {
    //         return res.status(400).json({
    //             success: false,
    //             message: "Password is required for account creation."
    //         });
    //     }     
    //     // const hashedPassword = await bcrypt.hash(userData.password, 10);
    //     // Hash password before saving
    //     const hashedPassword = await bcrypt.hash(password, 10);
    //     userData.password = hashedPassword;

    //     // Save user to database
    //     const user = new User(userData);
    //     await user.save();

    //     // Clear temporary session data
    //     delete req.session.otp;
    //     delete req.session.tempUserData;

    //     return res.json({
    //         success: true,
    //         message: "User verified successfully",
    //         redirectUrl: "/user/login"
    //     });
    
    // } catch (error) {
    //     console.error("Error in verifyOTP:", error);
    //     return res.status(500).json({
    //         success: false,
    //         message: "An error occurred during verification"
    //     });
    // }
};

const resendOTP = async (req, res) => {
    try {
        const userData = req.session.tempUserData;
        
        if (!userData || !userData.email) {
            return res.status(400).json({
                success: false,
                message: "Session expired. Please try signing up again."
            });
        }

        // Generate new OTP
        const newOTP = Math.floor(100000 + Math.random() * 900000).toString();
        req.session.otp = newOTP;

        // Send new OTP via email
        const emailSent = await sendVerificationEmail(userData.email, newOTP);
        
        if (!emailSent) {
            return res.status(500).json({
                success: false,
                message: "Failed to send OTP email"
            });
        }

        return res.json({
            success: true,
            message: "OTP resent successfully"
        });
    } catch (error) {
        console.error("Error in resendOTP:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to resend OTP"
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
    resendOTP,
    loginLoad,
    verifyLogin,
    pageNotFound,
    loadHome,
    userLogout
}