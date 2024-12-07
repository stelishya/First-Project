const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
// const randomstring = require('randomstring');
// const config = require('../config/config');
// const nodemailer = require('nodemailer');

// const securePassword = async (password) => {
//     try {
//         const passwordHash = await bcrypt.hash(password, 10)
//         return passwordHash;
//     } catch (error) {
//         console.log(error.message)
//     }
// }

exports.pageError = async(req,res)=>{
    res.render('admin/admin-error')
}

exports.loadLogin = (req, res) => {
    try {
        res.render('admin/admin-login',{message:null})
    } catch (error) {
        console.error("error on rendering login page")
    }
}

exports.login =async (req,res)=>{
    console.log('admin login req vann')
    try{
        const {email,password}= req.body;
    const admin=await User.findOne({email,is_admin:true});
    console.log("email : ", email)
    console.log(admin)
    if(admin){
        const passwordMatch= await bcrypt.compare(password,admin.password);
        if(passwordMatch){
            req.session.admin=true;
            return res.redirect('/admin/dashboard')
        }else{
            console.log('Password does not match');
            return res.redirect('/admin/login')
        }
    }else{
        console.log('Admin user not found');
        return res.redirect('/admin/login')
    }
    }catch(error){
        console.error('login error',error)
        return res.redirect('/pageError')
    }
    
}

exports.loadDashboard=async (req,res)=>{
    try{
    if (!req.session.admin) {
        console.log('Unauthorized access to dashboard');
        return res.redirect('/admin/login'); // Redirect to login if not an admin
    }
    // else if(req.session.admin){
        res.render('admin/dashboard')
    } catch (error) {
        console.error(error)  
        return res.redirect('/admin/pageError')
    }
}

exports.logout = async(req,res)=>{
    try {
        req.session.user_id=null;
        return res.redirect('/admin/login');    
    } catch (error) {
        console.log('unexpected error during logout')
        res.redirect('/admin/pageError')
    }
}

// const loadLogin = async (req, res) => {
//     try {
       
//         return res.render('admin/login');

//     } catch (error) {
//         console.log(error.message);
//     }
// }


// const verifyLogin = async (req, res) => {
//     try {
//         const email = req.body.email;
//         const password = req.body.password;

//         const userData = await User.findOne({ email: email });
//         if(userData){
        
//             const passwordMatch = await bcrypt.compare(password, userData.password);

//             if(passwordMatch){

//                 if(userData.is_admin === 0){

//                     res.render('admin/login',{ message:"You're not an admin.." });
//                 }
//                 else{
//                     req.session.admin_id = userData._id;
//                     return res.redirect('/admin/home');
//                 }
//             }
//             else{
//                 return res.render('admin/login', { message: "Invalid email or password" });
//             }
//         }else{
//             return res.render('admin/login', { message: "Invalid email or password" });
//         }

//     }catch (error) {
//         console.log(error.message);
//     }
// }

// const loadDashboard = async(req,res)=>{

//     try{
//         const userData = await User.findById({_id:req.session.admin_id});
//         return res.render('admin/home',{admin:userData});
//     } catch (error){
//         console.log(error.message);
//     }
// } 

// const logout = async(req,res)=>{
//     try{
//         req.session.admin_id=null;
//         return res.redirect('/admin');
//     } catch (error){
//         console.log(error.message);
//     }
// } 

// const adminDashboard = async(req,res)=>{
//     try{
//         const usersData = await User.find({is_admin:0});
//         res.render('admin/dashboard',{users:usersData});
//     } catch (error){
//         console.log(error.message);
//     }
// }

// //new user functionality

// const newUserLoad = async(req,res)=>{
//     try{  
//         res.render('admin/new-user')
//     }catch (error){
//         console.log(error.message);
//     }
// }

// const addUser = async(req,res)=>{
//     try{  
//         console.log(req.body);
//         const username = req.body.username;
//         const email = req.body.email;
//         const password = req.body.password;
//         const mobile = req.body.mobile;

//         const spassword = await securePassword(password);

//         const user = new User({
//             username:username,
//             email:email,
//             password:spassword,
//             mobile:mobile,
//             is_admin:0
//         })

//         const userData = await user.save();
      
//         if(userData){
//             res.redirect('/admin/dashboard');
//         }else{
//                 res.render('admin/new-user',{message:"Something went wrong..."});
//             }
        

//     }catch (error){
//         console.log(error.message);
//     }
// }

// //edit user functionality

// const editUserLoad = async(req,res)=>{
//     try{
//         const id = req.query.id;

//         // If id is missing or invalid, redirect to the dashboard
//         if (!id) {
//             console.log("User ID is undefined");
//             return res.redirect('/admin/dashboard');
//         }

//         const userData = await User.findById(id);// Find the user by id

//         if(userData){
//             return res.render('admin/edit-user',{user:userData,error:null});
//         }else{
//             return res.redirect('/admin/dashboard');// Redirect if user not found
//             }
        
        

//     }catch(error){
//         console.log(error.message);
//         res.status(500).send("Error loading user");
//         return res.redirect('/admin/dashboard'); // Redirect on error
//     }
// }

// const updateUsers = async (req,res)=>{
//     try{
//         const currentname=await User.findOne({username:req.body.username})
//             const existingemail=await User.findOne({email:req.body.email})
//             const current=await User.findOne({_id:req.body.id})
//             if(req.body.username!=current.username && currentname)
//                 {
                    
//                     res.render('admin/edit-user',{error:'This name already exist',user:current})
//                 }else if( req.body.email!=current.email && existingemail){
                 
//                     res.render('admin/edit-user',{error:'This email already exist',user:current})
//                 }else{
//                     const userData = await User.findByIdAndUpdate({ _id:req.body.id },{ $set:{ username:req.body.username, email:req.body.email, mobile:req.body.mobile, is_verified:req.body.verify} })
//                     res.redirect('/admin/dashboard');
//                 }
//     }catch(error){
//         console.log(error.message);
//     }
// }

// //delete users

// const deleteUser = async (req,res)=>{
//     try{
//         const id = req.query.id;
//         await User.deleteOne({ _id:id }); 
//         res.redirect('/admin/dashboard');
//     }catch(error){
//         console.log(error.message);
//     }
// }

// const searchUsers = async(req,res)=>{
//     try{
//         const searchTerm = req.query.query;//Retrieve the search term from the query parameter
         
//         // Check if search term is provided
//         if (!searchTerm) {
//             return res.redirect('/admin/dashboard'); // Redirect to dashboard if no search term is provided
//         }

//         // Use regular expression to search case-insensitive in `username`, `email`, or `mobile`
//         const usersData = await User.find({
            
//             $or: [
//                 { username: { $regex: searchTerm, $options: 'i' } }, // Case-insensitive search
//                 // { email: { $regex: searchTerm, $options: 'i' } },
//                 // { mobile: { $regex: searchTerm, $options: 'i' } }
//             ],
//             is_admin:0
//         });

//         // Render the dashboard with search results
//         res.render('admin/dashboard', { users: usersData });

 
//     }catch(error){
//         console.log(error.message);
//         res.status(500).json({ message: 'Error performing search' });
//         res.redirect('/admin/dashboard');
//     }
// }
// module.exports = {
//     loadLogin,
//     login,
//     loadDashboard,
//     verifyLogin,
//     loadDashboard,
//     logout,
//     adminDashboard,
//     newUserLoad,
//     addUser,
//     editUserLoad,
//     updateUsers,
//     deleteUser,
//     searchUsers
// }