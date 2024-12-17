const User = require("../models/userSchema");

const userAuth = (req, res, next) => {
  if (req.session && req.session.user && req.session.user._id) {
    User.findById(req.session.user._id)
      .then(data => {
        if (data && !data.is_blocked) {
          next();
        } else {
          // For AJAX requests, send JSON response
          if (req.xhr || req.headers.accept?.toLowerCase().includes('application/json')) {
            res.status(401).json({
              success: false,
              message: "Please login to continue"
            });
          } else {
            res.redirect("/user/login");
          }
        }
      })
      .catch(err => {
        console.error('Error in user auth middleware:', err);
        if (req.xhr || req.headers.accept?.toLowerCase().includes('application/json')) {
          res.status(500).json({
            success: false,
            message: "Internal Server Error"
          });
        } else {
          res.status(500).send('Internal Server Error');
        }
      });
  } else {
    // For AJAX requests, send JSON response
    if (req.xhr || req.headers.accept?.toLowerCase().includes('application/json')) {
      res.status(401).json({
        success: false,
        message: "Please login to continue"
      });
    } else {
      res.redirect("/user/login");
    }
  }
};

const adminAuth = async (req, res, next) => {
    try {
            const isAdmin = await User.findOne({ isAdmin: true });
            if(req.path==='/login'){
                if(req.session.admin && isAdmin){
                    res.redirect('/admin/dashboard')
                }else{
                    next();
                }
            }else if(req.session.admin){
                next();
            }else{
            res.redirect('/admin/login');
            }
        } catch (error) {
        console.error('Error in admin auth middleware:', error);
        res.redirect('/admin/login');
    }
};


module.exports = {
    userAuth,
    adminAuth
};