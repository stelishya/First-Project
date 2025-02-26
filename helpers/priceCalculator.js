    /**
     * Calculate product prices and discounts
     * @param {Object} product - The product object with mrp, productOffer, and category
     * @returns {Object} - Object containing calculated prices and discounts
     */
    const calculateProductPrices = (product) => {
        console.log("Product before price calculation:", product);
        const mrp = Number(product.mrp || 0);
        const productOffer = Number(product.productOffer || 0);
        const categoryOffer = Number(product.category?.categoryOffer || 0);
        const cat = Number(product.category.categoryOffer || 0);
        console.log("categoryOffer, cat :",categoryOffer,cat)
        const maxDiscount = Number(product.maxDiscount || 0);
        const offer = Math.max(productOffer, categoryOffer);
        const discount = Math.round((mrp * offer / 100) * 100) / 100;
        const priceAfterDiscount = Math.round((mrp - discount) * 100) / 100;   
        const finalAmount = maxDiscount ? Math.max(priceAfterDiscount, maxDiscount) : priceAfterDiscount;
        const Discount = mrp - finalAmount;
        // const discountPercentage = mrp > 0 ? Math.round((discount / mrp) * 100) : 0;

        console.log("calculate price : ",mrp,productOffer,categoryOffer,offer,discount,priceAfterDiscount,maxDiscount,Discount,finalAmount)
        return {
            mrp,
            offer,
            discount,
            priceAfterDiscount,
            finalAmount,
            Discount
            // discountPercentage
        };
    };
    
    /**
     * Calculate order item prices including quantity
     * @param {Object} item - Order item with product and quantity
     * @returns {Object} - Object containing calculated prices for the order item
     */
    const calculateOrderItemPrices = (item) => {
        const prices = calculateProductPrices(item.product || item.productId);
        const quantity = Number(item.quantity || 1);
        // const { product, quantity } = item;
        // const prices = calculateProductPrices(product);
    
        return {
            pricePerUnit: prices.finalAmount,
            totalPrice: prices.finalAmount * quantity,
            totalDiscount: prices.Discount * quantity,
            discountPercentage: prices.Discount,
            originalPrice: prices.mrp
        };
    };
    
   
    
    /**
     * Calculate cart totals
     * @param {Array} items - Array of cart/order items
     * @returns {Object} - Object containing total calculations
     */
    // const calculateTotals = (items) => {
    //     return items.reduce((totals, item) => {
    //         const prices = calculateOrderItemPrices(item);
    //         return {
    //             subtotal: totals.subtotal + prices.totalPrice,
    //             totalDiscount: totals.totalDiscount + prices.totalDiscount,
    //             totalItems: totals.totalItems + Number(item.quantity || 1)
    //         };
    //     }, { subtotal: 0, totalDiscount: 0, totalItems: 0 });
    // };
    const calculateTotals = (items) => {
        return items.reduce((acc, item) => {
            const prices = calculateOrderItemPrices(item);
            return {
                subtotal: (acc.subtotal || 0) + prices.totalPrice,
                totalDiscount: (acc.totalDiscount || 0) + prices.totalDiscount
            };
        }, { subtotal: 0, totalDiscount: 0 });
    };
    
    
/**
 * Calculate coupon discount based on coupon details and subtotal
 * @param {Object} coupon - The coupon object with offerPercentage, minimumPurchase, and maximumDiscount
 * @param {Number} subtotal - The subtotal amount before coupon discount
 * @returns {Number} - The calculated coupon discount amount
 */
const calculateCouponDiscount = (coupon, subtotal) => {
    if (!coupon || !subtotal || subtotal < coupon.minimumPurchase) {
        return 0;
    }

    let discountAmount = (subtotal * coupon.offerPercentage) / 100;

    // Apply maximum discount limit if set
    if (coupon.maximumDiscount) {
        discountAmount = Math.min(discountAmount, coupon.maximumDiscount);
    }

    return Math.round(discountAmount * 100) / 100;
};

    module.exports = {
        calculateProductPrices,
        calculateOrderItemPrices,
        calculateTotals,
        calculateCouponDiscount
    };