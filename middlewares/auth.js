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

const adminAuth=(req,res)=>{
    User.findOne({isAdmin:true})
    .then(data=>{
        if(data){
            next();
        }else{
            res.redirect('admin/login')
        }
    })
    .catch(err=>{
        console.log('Error in adminAuth middleware',err);
        res.status(500).send('Internal Server Error')
    })
}


module.exports = {
    userAuth,
    adminAuth
};