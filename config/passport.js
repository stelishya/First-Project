const passport= require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userSchema');
const env=require("dotenv").config()

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'http://localhost:4000/user/auth/google/callback'
},

async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });
        // console.log(profile)
        if (user) {
            return done(null, user);
        } else {
            user =  new User({
                username: profile.displayName, 
                email: profile.emails[0].value,
                googleId: profile.id
            });
            await user.save();
            return done(null, user);
        }
        
    } catch (error) {
        console.log("error in passport",error)
        return done(error,null)    
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id)
        .then(user => {
            done(null, user);
        })
        .catch(err => {
            done(err, null);
        });
});

module.exports = passport; 