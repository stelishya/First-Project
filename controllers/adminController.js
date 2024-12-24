const User = require('../models/userSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');


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

