const mongoose = require('mongoose');
const {Schema} = mongoose ;

const walletSchema = new Schema({

})

const Wallet = mongoose.model("Wallet", walletSchema);
module.exports=Wallet;