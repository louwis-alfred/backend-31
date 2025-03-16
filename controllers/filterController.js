import Order from '../models/orderModel.js';
import mongoose from 'mongoose';

// Get orders with query parameter filtering
export const getFilteredOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, startDate, endDate, minAmount, maxAmount } = req.query;
    
    // Build filter query
    const query = { userId };
    
    // Add status filter if provided
    if (status && status !== "All") {
      query.status = status;
    }
    
    // Add date range filter if provided
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    // Add amount range filter if provided
    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = Number(minAmount);
      if (maxAmount) query.amount.$lte = Number(maxAmount);
    }
    
    const orders = await Order.find(query)
      .populate({
        path: "items.product",
        select: "name price images sellerId",
      })
      .sort({ date: -1 });
    
    // Enhance orders with courier info
    const enhancedOrders = await Promise.all(
      orders.map(async (order) => {
        const orderObj = order.toObject();
        
        // Additional logic for courier info if needed
        
        return orderObj;
      })
    );
    
    return res.status(200).json({
      success: true,
      orders: enhancedOrders
    });
    
  } catch (error) {
    console.error("Error fetching filtered orders:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve filtered orders",
      error: error.message
    });
  }
};

// Get orders by specific status
export const getOrdersByStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status } = req.params;
    
    // Validate status parameter
    const validStatuses = [
      "Pending Confirmation", "Confirmed", "Processing", 
      "Shipped", "Delivered", "Cancelled", "Rejected", "Refunded"
    ];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status parameter"
      });
    }
    
    const orders = await Order.find({ 
      userId, 
      status 
    })
    .populate({
      path: "items.product",
      select: "name price images sellerId",
    })
    .sort({ date: -1 });
    
    return res.status(200).json({
      success: true,
      status,
      count: orders.length,
      orders
    });
    
  } catch (error) {
    console.error("Error fetching orders by status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve orders by status",
      error: error.message
    });
  }
};