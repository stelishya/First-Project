const User = require("../models/userSchema");

const userAuth = (req, res, next) => {
  if (req.session && req.session.user && req.session.user._id) {
    User.findById(req.session.user._id)
      .then(data => {
        if (data && !data.is_blocked) {
          next();
        } else {
          delete req.session.user;
          req.session.save((err) => {
            if (err) {
              console.error('Error saving session:', err);
            }
            return res.redirect('/user/login');
          });
        }
      })
      .catch(err => {
        console.error('Error in user auth middleware:', err);
        return res.status(500).send('Internal Server Error');
      });
  } else {
    // User is not authenticated, redirect to login
    res.redirect('/user/login');
  }
};

const adminAuth = async (req, res, next) => {
    try {
            const admin = await User.findOne({ 
              is_admin: true,
              is_blocked: { $ne: true }, 
              is_verified: true 
             });
             if (!admin) {
              console.error('No valid admin account found');
              return res.status(403).redirect('/admin/login');
            }
            if(req.path==='/login'){
                if(req.session.admin && req.session.adminId === admin._id.toString()){
                  return res.redirect('/admin/dashboard')
                }else{
                  return next();
                }
            }else if(req.session.admin && req.session.adminId === admin._id.toString()){
              req.admin = admin;
              return next();
            }else{
              return res.redirect('/admin/login');
            }
        } catch (error) {
        console.error('Error in admin auth middleware:', error);
        return res.status(500).redirect('/admin/login');
    }
};


module.exports = {
    userAuth,
    adminAuth
};