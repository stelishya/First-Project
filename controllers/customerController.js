const User = require('../models/userSchema');



exports.customerInfo = async (req,res)=>{
    try {
        let search='';
        if(req.query.search){
            search = req.query.search
        }
        let page=1;
        if(req.query.page){
            page=req.query.page 
        }
        const limit=8;
        const userData = await User.find({
            is_admin:false,
            $or:[
                {name:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}}
            ],
        })
        .limit(limit*1)
        .skip((page-1)*limit)
        .exec();

        const count = await User.find({
            is_admin:false,
            $or:[
                {name:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}}
            ],
        }).countDocuments()
        const totalPages = Math.ceil(count /limit);
        const currentPage = page;
        res.render('admin/customers',{
            data:userData,
            search,
            count,
            totalPages,
            currentPage,
            limit,
            activeTab: 'users'
        });
    } catch (error) {
        console.log(error);
    }
}

exports.blockCustomer = async (req,res)=>{
    try {
        let id = req.query.id;
        await User.updateOne({_id:id},{$set:{is_blocked:true}});
        return res.redirect('/admin/users');
    } catch (error) {
        console.error('block customer error',error)
        return res.redirect('/pageError');
    }
}

exports.unblockCustomer = async (req,res)=>{
    try {
        let id = req.query.id;
        await User.updateOne({_id:id},{$set:{is_blocked:false}});
        return res.redirect('/admin/users');
    } catch (error) {
        console.error('unblock customer error',error)
        return res.redirect('/pageError');
    }
}