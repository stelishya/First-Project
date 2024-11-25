const express = require('express');
const admin_route =express.Router();

const session = require('express-session');
const config = require('../config/config');
admin_route.use(session({
    secret:config.sessionSecret,
    resave: false,// Don't save unmodified session
    saveUninitialized: true,//sessions won't be created until the session has data.
    cookie: { secure: false } // Set to true when using HTTPS
}));

const bodyParser = require("body-parser");
admin_route.use(bodyParser.json());
admin_route.use(bodyParser.urlencoded({extended:true}));

// admin_route.set('views','./views/admin');

// const auth = require('../middleware/adminAuth'); 

const adminController =require("../controllers/adminController");

admin_route.get('/',adminController.loadLogin);
admin_route.get('/login',adminController.loadLogin);


admin_route.post('/login',adminController.verifyLogin);

admin_route.get('/home',adminController.loadDashboard);

admin_route.get('/logout',adminController.logout);

admin_route.get('/dashboard',adminController.adminDashboard);

admin_route.get('/new-user',adminController.newUserLoad);

admin_route.post('/new-user',adminController.addUser);

admin_route.get('/edit-user',adminController.editUserLoad);

admin_route.post('/edit-user',adminController.updateUsers);

admin_route.get('/delete-user',adminController.deleteUser);

admin_route.get('/search',adminController.searchUsers);



admin_route.get('*',function (req,res){
    res.redirect('/admin');
})

module.exports =admin_route;