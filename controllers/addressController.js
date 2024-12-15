const Users = require('../models/userSchema')
const Addresses = require('../models/addressSchema')

exports.showUserAddresses = async (req,res)=>{
    try {
        const session = req.session.user;
        if (!session) {
            console.error("Session is undefined. User might not be logged in.");
            return res.status(401).send("User not authenticated");
        }

        const addresses = await Addresses.find({userId:session._id});
        console.log("Addresses found:", addresses);

        // Transform addresses to match the expected format
        const transformedAddresses = addresses.map(doc => {
            if (doc.address && doc.address.length > 0) {
                return {
                    _id: doc._id,
                    userId: doc.userId,
                    address: doc.address.map(addr => ({
                        _id: addr._id,
                        typeOfAddress: addr.typeOfAddress,
                        name: addr.name,
                        streetAddress: addr.streetAddress,
                        city: addr.city,
                        state: addr.state,
                        country: addr.country,
                        pincode: addr.pincode,
                        mobile: addr.mobile
                    }))
                };
            }
            return doc;
        });

        res.render('users/dashboard/address',{
            addresses: transformedAddresses,
            session,
            activeTab:'addresses'
        });
    } catch (error) {
        console.error("Error in showUserAddresses",error);
        res.status(500).send("Internal Server Error");
    }
}

exports.addAddress = async (req,res)=>{
    try {
        const address = req.body;
        const userId = req.session.user._id;

        // Find existing address document or create new one
        let addressDoc = await Addresses.findOne({ userId: userId });
        
        if (!addressDoc) {
            addressDoc = new Addresses({
                userId: userId,
                address: [] // Initialize empty array
            });
        }

        // Create new address object
        const newAddress = {
            typeOfAddress: address.typeOfAddress || 'Home', // Default to 'Home' if not provided
            name: address.name,
            streetAddress: address.streetAddress,
            city: address.city,
            state: address.state,
            country: address.country,
            pincode: address.pincode,
            mobile: address.mobile
        };

        // Push new address to array
        addressDoc.address.push(newAddress);
        await addressDoc.save();

        console.log("Address saved successfully");
        res.status(201).json({ success: true, message: "Address successfully added" });
    } catch (error) {
        console.error("Error saving address:", error);
        res.status(500).json({ success: false, message: "Error saving address", error: error.message });
    }
}

exports.deleteAddress = async (req, res) => {
    try {
        const addressId = req.params.addressId;
        const userId = req.session.user._id;

        console.log("Deleting address:", { addressId, userId });

        const addressDoc = await Addresses.findOne({ userId: userId });
        if (!addressDoc) {
            return res.status(404).json({ success: false, message: "Address document not found" });
        }

        const addressIndex = addressDoc.address.findIndex(addr => addr._id.toString() === addressId);
        if (addressIndex === -1) {
            return res.status(404).json({ success: false, message: "Address not found" });
        }

        addressDoc.address.splice(addressIndex, 1);
        await addressDoc.save();

        console.log("Address deleted successfully");
        res.status(200).json({ success: true, message: "Address deleted successfully" });
    } catch (error) {
        console.error("Error deleting address:", error);
        res.status(500).json({ success: false, message: "Error deleting address", error: error.message });
    }
};

exports.editAddress = async (req,res)=>{
    try {
        const addressId = req.params.addressId;
        const address = req.body;
        const userId = req.session.user._id;

        console.log("Editing address:", { addressId, address, userId });

        // Find the user's address document
        const addressDoc = await Addresses.findOne({ userId: userId });
        if (!addressDoc) {
            return res.status(404).json({ success: false, message: "Address document not found" });
        }

        // Find the specific address in the array
        const addressIndex = addressDoc.address.findIndex(addr => addr._id.toString() === addressId);
        if (addressIndex === -1) {
            return res.status(404).json({ success: false, message: "Specific address not found" });
        }

        // Update the specific address in the array
        addressDoc.address[addressIndex] = {
            ...addressDoc.address[addressIndex].toObject(), // Convert to plain object
            typeOfAddress: address.typeOfAddress || addressDoc.address[addressIndex].typeOfAddress,
            name: address.name,
            streetAddress: address.streetAddress,
            city: address.city,
            state: address.state,
            country: address.country,
            pincode: address.pincode,
            mobile: address.mobile
        };

        // Save the updated document
        await addressDoc.save();
        console.log("Address updated successfully");
        
        res.status(200).json({ success: true, message: "Address updated successfully" });
    } catch (error) {
        console.error("Error editing address:", error);
        res.status(500).json({ success: false, message: "Error editing address", error: error.message });
    }
}

exports.getAddressPage = async (req,res)=>{
    try {
        const userId = req.session.user._id;
        const addresses = await Addresses.find({userId})
        res.render('users/order/address',{
            addresses,activeTab:'addresses'
        })
    } catch (error) {
        console.error(error)
    }
}