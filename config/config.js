const path = require('path');

module.exports = {
    PORT: process.env.PORT || 4000,
    // DATABASE_URL: process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/mydatabase',
    DATABASE_URL: process.env.DATABASE_URL || 'mongodb+srv://stelishya:Selu2006@cluster0.rwrwx.mongodb.net/calliope?retryWrites=true&w=majority&appName=Cluster0',
    SECRET: process.env.SECRET || 'secret_key',
    NODEMAILER_EMAIL: process.env.NODEMAILER_EMAIL,
    NODEMAILER_PASSWORD: process.env.NODEMAILER_PASSWORD 
};
