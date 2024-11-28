const mongoose = require('mongoose')
const config = require('../config')

const connectDB = async () => {
    try {
        const dbUrl = config.DATABASE_URL
        console.log('Attempting to connect to:', dbUrl)
        await mongoose.connect(dbUrl, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        })
        console.log('Database connected successfully')
    } catch (error) {
        console.error('Database connection error:', error.message)
        process.exit(1)
    }
}

module.exports = connectDB