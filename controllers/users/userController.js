const User = require('../../models/userSchema')
const nodemailer = require('nodemailer')
const bcrypt = require('bcrypt');

// const securePassword = async (password) => {
//     try {
//         const passwordHash = await bcrypt.hash(password, 10)
//         return passwordHash;
//     } catch (error) {
//         console.log('Error hashing password:',error.message)
//     }
// } 

exports.loadRegister = async (req, res) => {
    try {
        return res.render('users/signup');

    } catch (error) {
        console.log('Home page not loading', error.message);
        res.status(500).send('Server error')
    }
}

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

async function sendVerificationEmail(email, otp) {
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
            service: 'gmail',
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

exports.insertUser = async (req, res) => {
    try {
        console.log('Request Body:', req.body);
        const { username, email, language, mobile, password, confirm_password } = req.body;

        if (password !== confirm_password) {
            return res.status(400).render('users/signup', { message: 'Passwords do not match' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            const newuser = new User({
                username: username,
                password: await bcrypt.hash(req.body.password, 10),// Hashing password for security
                email: email,
                mobile: mobile,
                language: language,
                createdAt: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
            });
            // save the new user
            await newuser.save();
            console.log("User saved successfully");


            // if(findUser) {
            //     return res.render('users/signup', {message: 'User with this email already exists'});
            // }
            const otp = generateOtp();

            try {
                await sendVerificationEmail(email, otp)
                req.session.otp_cred = email;
                req.session.otp = parseInt(otp);
                req.session.otpExpires = Date.now() + 10 * 60 * 1000; // 10-min expiration
                console.log(`generated OTP : ${otp}`);
                console.log("req.session.otp:", req.session.otp)
                console.log('OTP sent successfully')
            } catch (error) {
                console.error('Error sending OTP email', error)
            }
            console.log("Email:", email);
            // Redirect to OTP page
            return res.render('users/verifyOTP_signup', { email })
        } else {
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

    } catch (error) {

        console.error('signup error', error);
        return res.status(500).render('users/signup', { message: 'An error occurred during signup' });
    }
};

// const securePassword = async (password) => {
//     try {
//         const passwordHash = await bcrypt.hash(password, 10)
//         return passwordHash;
//     } catch (error) {
//         console.error('Error hashing password:',error.message)
//     }
// }

exports.verifyOTP = async (req, res) => {
    try {
        const submittedOTP = parseInt(req.body.otp.join(''));
        console.log('submittedOTP', submittedOTP)
        console.log("isOTPmatched", Number(req.session.otp) === submittedOTP)

        if (req.session.otp === submittedOTP && req.session.otpExpires > Date.now()) {
            // const user=req.session.
            req.session.otp = null;
            req.session.otpExpires = null;
            console.log('hai hello')
            await User.findOneAndUpdate({ email: req.session.otp_cred }, { is_verified: true })
            // console.log()
            console.log('hai hello')
            res.status(200).json({ success: true, message: "successfully verified" })
        } else if (req.session.otpExpires < Date.now()) {
            res.status(400).json({ success: false, message: 'OTP Expired' })
        } else {
            res.status(400).json({ message: 'Invalid OTP' })
        }

    } catch (error) {
        console.error('Error in verifying OTP: ', error)
        res.status(500).send('Server error');
    }
};

exports.resendOTP = async (req, res) => {
    // console.log("resend otp hai parann")
    try {
        const email = req.session.otp_cred;
        console.log('email', email)
        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Session expired. Please try signing up again."
            });
        }
        // Generate new OTP
        const newOTP = generateOtp();

        try {
            // Send new OTP via email
            await sendVerificationEmail(email, newOTP);

            // Update session with new OTP
            req.session.otp = parseInt(newOTP);
            req.session.otpExpires = Date.now() + 10 * 60 * 1000; // 10-min expiration
            console.log('newotp', parseInt(newOTP))

            console.log('New OTP generated and saved:', {
                email: email,
                otp: newOTP,
                expires: req.session.otpExpires
            });
            res.render('users/verifyOTP_signup', { email })
        } catch (error) {
            console.error("Error sending new OTP:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to send OTP email"
            });
        }
    } catch (error) {
        console.error("Error in resendOTP:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to resend OTP"
        });
    }
};

//Login user methods started
exports.loginLoad = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.render('users/login', { message: null });
        }
    } catch (error) {
        console.log(error.message);
    }
}

exports.verifyLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        // const email = req.body.email;
        // const password = req.body.password;

        const userData = await User.findOne({ is_admin: 0, email: email });
        if (!userData) {
            return res.render('users/login', { message: "User Not Found" });
        }
        if (userData.is_blocked) {
            return res.render('users/login', { message: 'User is blocked by admin' })
        }
        if (userData) {
            const passwordMatch = await bcrypt.compare(password, userData.password);
            if (passwordMatch) {
                req.session.user = userData;
                req.session.user_id = userData._id; // Set session after successful login
                req.session.username = userData.username;
                console.log('Login successful!');
                return res.render('users/home', { user: userData });// Redirect to home page after login

            } else {
                return res.render('users/login', { message: "Incorrect password" });
            }
        }
        

    }
    catch (error) {
        console.log('Login Error: ', error.message);
        res.status(500).send('Internal server error');
        return res.render('users/login', { message: "Login failed. Please try again." });
    }
}

exports.forgotPasswordPage= async(req,res)=>{

    try {
        const { email } = req.body;
        req.session.forgotCred = email;
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Generate a password reset token (simplified here)
        const resetToken = Math.random().toString(36).substr(2);
        user.resetToken = resetToken;
        user.resetTokenExpiry = Date.now() + 3600000; // 1-hour expiry
        await user.save();

        // Send reset link via email (mocked here)
        console.log(`Send reset link to: ${email} with token: ${resetToken}`);
        // res.status(200).json({ message: "Reset link sent to your email" });

         // Configure the email transport
         const transporter = nodemailer.createTransport({
            port: 587,
            secure: false,
            service: 'gmail',
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL, //email address
                pass: process.env.NODEMAILER_PASSWORD, // App password
            },
            tls: {
                rejectUnauthorized: false  // Accept self-signed certificates
            }
        });

         // Email content
         const mailOptions = {
            from:{
                name: 'Calliope',
                address: process.env.NODEMAILER_EMAIL 
            },
            to: email,
            subject: 'Password Reset',
            html: `
                <h1>Password Reset</h1>
                <p>You requested a password reset. Click the link below to reset your password:</p>
                <a href="http://localhost:4000/user/reset-password?token=${resetToken}">Reset Password</a>
                <p>If you did not request this, please ignore this email.</p>
            `,
        };
        // Verify connection configuration
        await transporter.verify();
        console.log('Transporter verified successfully');

         // Send the email
        const info =  await transporter.sendMail(mailOptions);
        if(info&& info.response){
            console.log("Email sent: ", info.response); // Logs the email sending status
            console.log(`Reset email sent to: ${email}`);
            res.status(200).json({ message: 'Reset link sent to your email' });
            return true;  // Email sent successfully
        } else {
            console.error("Error: No response from email transporter");
            return false; // Failure in sending email
        }
        
 
    } catch (error) {
        console.log('Error in forgotPasswordPage: ', error);
        res.status(500).json({ message: "Server error. Please try again." });
    }
}

exports.resetPassword = async (req, res) => {
    console.log('Incoming Reset Password Request:', req.body);
    const { newPassword } = req.body;
    const email = req.session.forgotCred;

    try {
        await User.findOneAndUpdate({email},{password:newPassword});

        res.status(200).json({ message: 'Password reset successful' });
    } catch (error) {
        console.error('Error in resetPassword:', error);
        res.status(500).json({ message: 'Server error. Please try again.' });
    }
};


exports.sendOtp=async (req,res)=>{
    try {
        
    } catch (error) {
        console.log('Error in sendOtp: ', error);

    }
}

// exports.verifyGoogleLogin = async (req, res) => {
//     try {
//         console.log("verifyGoogleLogin")
//         const { email, googleId } = req.body;

//         // Wait for the database query to resolve
//         const userData = await User.findOne({ email: email, googleId: googleId });
//         console.log("Request Body:", req.body);
//         console.log("User Data:", userData);

//         if (!userData) {
//             return res.render('users/login', { message: "User Not Found" });
//         }
//         if (userData.is_blocked) {
//             return res.render('login', { message: 'User is blocked by admin' })
//         }
//         // Set session after successful login
//         req.session.user = {
//             _id: userData._id,
//             email: userData.email,
//             googleId: userData.googleId,
//         }
//         req.session.user_id = userData._id;

//         console.log('Login successful!');
//         res.render('users/home', { user: userData });// Render home page after login

//     } catch (error) {
//         console.error("Error in verifyGooglrLogin : ", error);
//         res.status(500).send("Internal server error");
//     }
// };

exports.pageNotFound = async (req, res) => {
    try {
        // res.status(404).render('layouts/404');
        res.render('page-404')
    }
    catch (error) {
        console.error(error)
        res.redirect('/user/pageNotFound')
    }
}

exports.loadHome = async (req, res) => {
    try {
        // const session=req.session.user;
        // if(userData){
        //     const userData = await User.findOne({_id:userData._id})
        //     return res.render('users/home',{ user:userData });
        // }else{
        //     return res.render('users/home')
        // }

        const title = 'CAlliope';
        // const userGreet=req.session.user ? session.username || session.
        // console.log('welcome to home page!')
        const userData = await User.findOne({ _id: req.session.user_id })
        // console.log(userData)
        return res.render('users/home', { user: userData });
    } catch (error) {
        console.log('Home Page Not Found', error.message);
        res.status(500).send('Server Error')
    }
}

exports.dashboard = async (req, res) => {
    try {
        const session = req.session.user;
        // const errorMessage = req.session.user.errorMess;
        // const successMessage = req.session.user.successMess;
        const user = await User.findOne({ email: session.email })
        res.render('users/dashboard/profile', {
            session: session.email, user,
            //  errorMessage, successMessage, 
             activeTab: 'profile'
        })
    } catch (error) {
        console.error("Error in user Dashboard",error)
        res.redirect("/user/pageNotFound")
    }
}

exports.saveUserDetails = async (req, res) => {
    const userData = req.body;
    const session = req.session.user;
    console.log("saveUserDetails session: ",session)
    try {
        const usernameChk = await User.findOne({ username: userData.username, email: { $ne: session.email } })
        if (!usernameChk) {
            await User.findOneAndUpdate({ email: session.email }, {
                username: userData.username,
                // fullname: userData.fullname,
                mobile: userData.mobile
            })
            res.status(200).json({success:true, message:'Successfully updated'});
        } else {
            req.session.user.errorMess = 'Username already exists'
            res.redirect(`/user/profile`)
        }
    } catch (error) {
        console.error("Error in saveUserDetails: ", error)
        res.status(500).json({ success: false, message: 'Server error' });

    }
}

exports.changePassword = async (req, res) => {
    const session = req.session.user;
    console.log("changePassword session : ",session)

    if (session) {
        try {
            const user = await User.findOne({ email: session.email });
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            await User.findOneAndUpdate({ email: session.email }, { password: await bcrypt.hash(req.body.password, 10) })
            res.status(200).json('Password edited succesfully')
        } catch (error) {
            console.log(error)
        }
    } else {
        const { email, newPass } = req.body;
        try {
            await User.findOneAndUpdate({ email }, { password: await bcrypt.hash(newPass, 10) })
            res.status(200).json({success:true,message:"Password changed successfully"})
        } catch (error) {
            console.error("Error in changePassword",error)
            res.status(500).json({success:false,message:"Couldn't change the password"})
        }
    }
}

exports.userLogout = (req, res) => {
    try {
        req.session.user_id = null;
        console.log("userLogout - try")

        return res.render('users/login');

    } catch (error) {
        console.error('userLogout error', error);
        req.redirect('/user/pageNotFound')
    }
}

