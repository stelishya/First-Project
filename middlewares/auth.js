const User = require("../models/userSchema");

const userAuth = (req, res, next) => {
  if (req.session.user) {
    User.findById(req.session.user)
      .then(data => {
        if (data && !data.is_blocked) {
          next();
        } else {
          res.redirect("/login");
        }
      })
      .catch(err => {
        console.error('Error in user auth middleware',err);
        res.status(500).send('Internal Server Error')
      });
  } else {
    res.redirect("/login");
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