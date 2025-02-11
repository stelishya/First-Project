const User = require('../models/userSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const Orders = require('../models/orderSchema');
const { generateSalesReport } = require('./salesController');
const Wallets = require('../models/walletSchema');



exports.pageError = async(req,res)=>{
    res.render('admin/admin-error')
}

exports.loadLogin = (req, res) => {
    try {
        res.render('admin/admin-login',{message:null})
    } catch (error) {
        console.error("error on rendering login page")
    }
}

exports.login =async (req,res)=>{
    console.log('admin login req vann')
    try{
        const {email,password}= req.body;
    const admin=await User.findOne({email,is_admin:true});
    console.log("email : ", email)
    console.log(admin)
    if(admin){
        const passwordMatch= await bcrypt.compare(password,admin.password);
        if(passwordMatch){
            req.session.admin=true;
            req.session.adminId = admin._id.toString();
            return res.redirect('/admin/dashboard')
        }else{
            console.log('Password does not match');
            return res.redirect('/admin/login')
        }
    }else{
        console.log('Admin user not found');
        return res.redirect('/admin/login')
    }
    }catch(error){
        console.error('login error',error)
        return res.redirect('/pageError')
    }
    
}



exports.logout = async(req,res)=>{
    try {
        // req.session.user_id=null;
        // return res.redirect('/admin/login');   
        req.session.admin = null;
        req.session.adminId = null;
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
                return res.redirect('/admin/pageError');
            }
            return res.redirect('/admin/login');
        }); 
    } catch (error) {
        console.log('unexpected error during logout')
        res.redirect('/admin/pageError')
    }
}

exports.loadDashboard=async (req,res)=>{
    try{
        console.log("loadDashboard called")
    if (!req.session.admin) {
        console.log('Unauthorized access to dashboard');
        return res.redirect('/admin/login'); 
    }
        const { startDate, endDate, period } = req.query;

        const reportData = await generateSalesReport(req.query);
        const queryString = new URLSearchParams({
            startDate: startDate || '',
            endDate: endDate || '',
            period: period || ''
        }).toString();
        
        res.render('admin/dashboard', {
            admin: req.session.admin,
            reportData: reportData || { 
                orders: [], 
                summary: { 
                    totalOrders: 0, 
                    totalAmount: 0, 
                    totalDiscount: 0, 
                    totalCouponDiscount: 0, 
                    netAmount: 0 
                } 
            },
            startDate: startDate || '',
            endDate: endDate || '',
            period: period || '',
            query: queryString
        });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.status(500).render('admin/dashboard', {
            admin: req.session.admin,
            error: 'Failed to load dashboard data',
            reportData: { 
                orders: [], 
                summary: { 
                    totalOrders: 0, 
                    totalAmount: 0, 
                    totalDiscount: 0, 
                    totalCouponDiscount: 0, 
                    netAmount: 0 
                } 
            },
            startDate: '',
            endDate: '',
            period: '',
            query: ''
        });
    }
}





exports.getSalesReport = async (req, res) => {
    try {
        const { startDate, endDate, period } = req.query;
        let query = { status: 'Delivered' };
        let start, end;

        if (period) {
            const now = new Date();
            switch (period) {
                case 'daily':
                    start = new Date(now.setHours(0, 0, 0, 0));
                    end = new Date(now.setHours(23, 59, 59, 999));
                    break;
                case 'weekly':
                    start = new Date(now.setDate(now.getDate() - 7));
                    end = new Date();
                    break;
                case 'monthly':
                    start = new Date(now.setMonth(now.getMonth() - 1));
                    end = new Date();
                    break;
                case 'yearly':
                    start = new Date(now.setFullYear(now.getFullYear() - 1));
                    end = new Date();
                    break;
            }
        } else if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
        }

        if (start && end) {
            query.orderDate = { $gte: start, $lte: end };
        }

        const orders = await Orders.find(query)
            .populate('userId', 'name email')
            .populate('products.productId', 'name mrp')
            .sort({ orderDate: -1 });

        let totalOrders = orders.length;
        let totalAmount = 0;
        let totalDiscount = 0;
        let totalCouponDiscount = 0;

        orders.forEach(order => {
            totalAmount += order.totalAmount;
            totalDiscount += order.totalDiscount || 0;
            totalCouponDiscount += order.couponDiscount || 0;
        });
        const reportData = {
            orders: orders.map(order => ({
                orderId: order._id,
                customerName: order.userId.name,
                orderDate: order.orderDate,
                totalAmount: order.totalAmount,
                discount: order.totalDiscount || 0,
                couponDiscount: order.couponDiscount || 0,
                finalAmount: order.finalAmount,
                status: order.status
            })),
            summary: {
                totalOrders,
                totalAmount,
                totalDiscount,
                totalCouponDiscount,
                netAmount: totalAmount - totalDiscount - totalCouponDiscount
            }
        };

        res.render('admin/dashboard', {
            reportData,
            startDate: start?.toISOString().split('T')[0],
            endDate: end?.toISOString().split('T')[0],
            period
        });

    } catch (error) {
        console.error('Error generating sales report:', error);
        res.status(500).json({ error: 'Failed to generate sales report' });
    }
};



exports.downloadReport = async (req, res) => {
    try {
        const { format } = req.query;
        const reportData = await generateSalesReport(req.query);

        if (format === 'pdf') {
            const doc = new PDFDocument();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');
            doc.pipe(res);

            doc.fontSize(20).text('Sales Report', { align: 'center' });
            doc.moveDown();
            
            doc.fontSize(14).text('Summary');
            doc.fontSize(12)
               .text(`Total Orders: ${reportData.summary.totalOrders}`)
               .text(`Total Amount: ₹${reportData.summary.totalAmount.toFixed(0)}`)
               .text(`Total Discount: ₹${reportData.summary.totalDiscount.toFixed(0)}`)
               .text(`Total Coupon Discount: ₹${reportData.summary.totalCouponDiscount.toFixed(0)}`)
            //    .text(`Net Amount: ₹${reportData.summary.netAmount.toFixed(2)}`);
            
            doc.moveDown();

            doc.fontSize(14).text('Order Details');
            reportData.orders.forEach(order => {
                doc.fontSize(12)
                   .text(`Order ID: ${order.orderId}`)
                   .text(`Customer: ${order.customerName}`)
                   .text(`Date: ${new Date(order.orderDate).toLocaleDateString()}`)
                   .text(`Amount: ₹${order.finalAmount.toFixed(2)}`)
                   .moveDown();
            });

            doc.end();

        } else if (format === 'excel') {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sales Report');

            worksheet.columns = [
                { header: 'Order ID', key: 'orderId', width: 30 },
                { header: 'Customer', key: 'customerName', width: 20 },
                { header: 'Date', key: 'orderDate', width: 15 },
                { header: 'Amount', key: 'totalAmount', width: 15 },
                { header: 'Discount', key: 'discount', width: 15 },
                { header: 'Coupon', key: 'couponDiscount', width: 15 },
                { header: 'Final Amount', key: 'finalAmount', width: 15 }
            ];

            worksheet.addRows(reportData.orders);

            worksheet.addRow([]);
            worksheet.addRow(['Summary']);
            worksheet.addRow(['Total Orders', reportData.summary.totalOrders]);
            worksheet.addRow(['Total Amount', reportData.summary.totalAmount]);
            worksheet.addRow(['Total Discount', reportData.summary.totalDiscount]);
            worksheet.addRow(['Total Coupon Discount', reportData.summary.totalCouponDiscount]);
            worksheet.addRow(['Net Amount', reportData.summary.netAmount]);

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=sales-report.xlsx');

            await workbook.xlsx.write(res);
            res.end();
        }

    } catch (error) {
        console.error('Error downloading report:', error);
        res.status(500).json({ error: 'Failed to download report' });
    }
};
