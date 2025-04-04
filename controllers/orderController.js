import mongoose from "mongoose";
import Order from "../models/orderModel.js";
import Product from "../models/productModel.js";
import NotificationService from "../services/notificationService.js";
import { isWithinCancellationPeriod, CANCELLATION_TIME_LIMIT } from "../utils/orderUtils.js";


// Seller confirms or rejects an order
export const sellerConfirmOrder = async (req, res) => {
  try {
    const { orderId, action, reason } = req.body;
    const sellerId = req.user._id;

    // Validate action
    if (!["confirm", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be either 'confirm' or 'reject'"
      });
    }

    // Find order with populated product information
    const order = await Order.findById(orderId).populate({
      path: "items.product",
      select: "sellerId name price images stock"
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Verify seller's products in order
    const sellerItems = order.items.filter(
      item => item.product && item.product.sellerId.toString() === sellerId.toString()
    );

    if (sellerItems.length === 0) {
      return res.status(403).json({
        success: false,
        message: "You don't have any products in this order"
      });
    }

    // Validate order status
    if (order.status !== "Pending Confirmation" && order.status !== "Order Placed") {
      return res.status(400).json({
        success: false,
        message: `Cannot ${action} order in ${order.status} status`
      });
    }

    // Handle confirmation or rejection
    if (action === "confirm") {
      // Check stock availability
      const insufficientStockItems = sellerItems.filter(
        item => item.product.stock < item.quantity
      );

      if (insufficientStockItems.length > 0) {
        const itemNames = insufficientStockItems.map(item => item.product.name).join(", ");
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for: ${itemNames}`
        });
      }

      order.status = "Confirmed";

      // Add to order tracking history
      if (!order.tracking) order.tracking = { history: [] };
      order.tracking.history.push({
        status: "Confirmed",
        timestamp: new Date(),
        note: reason || "Order confirmed by seller",
        updatedBy: sellerId
      });

    } else {
      // Handle rejection
      order.status = "Rejected";

      // Restore stock quantities
      for (const item of sellerItems) {
        await Product.findByIdAndUpdate(item.product._id, {
          $inc: { stock: item.quantity }
        });
      }

      // Add rejection to tracking history
      if (!order.tracking) order.tracking = { history: [] };
      order.tracking.history.push({
        status: "Rejected",
        timestamp: new Date(),
        note: reason || "Order rejected by seller",
        updatedBy: sellerId
      });
    }

    await order.save();

    // Notify customer
    await NotificationService.createOrderNotification(
      order.userId,
      order,
      action === "confirm" ? "ORDER_CONFIRMED" : "ORDER_REJECTED"
    );

    return res.json({
      success: true,
      message: `Order ${action}ed successfully`,
      order: {
        _id: order._id,
        status: order.status,
        tracking: order.tracking,
        items: sellerItems.map(item => ({
          productId: item.product._id,
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.price
        }))
      }
    });

  } catch (error) {
    console.error(`Error ${req.body.action}ing order:`, error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getOrderHistory = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    const order = await Order.findById(orderId)
      .populate('tracking.history.updatedBy', 'name email role')
      .populate('sellerActions.sellerId', 'name email')
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Check permissions
    if (!isAdmin && order.userId.toString() !== userId.toString()) {
      const isSeller = order.items.some(item => 
        item.product?.sellerId?.toString() === userId.toString()
      );

      if (!isSeller) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to view this order's history"
        });
      }
    }

    // Compile complete history from different sources
    const history = [
      // Basic tracking history
      ...(order.tracking?.history || []).map(entry => ({
        type: 'status',
        status: entry.status,
        timestamp: entry.timestamp,
        note: entry.note,
        updatedBy: entry.updatedBy?.name || 'System',
        userRole: entry.updatedBy?.role || 'system'
      })),

      // Seller actions
      ...(order.sellerActions || []).map(action => ({
        type: 'seller_action',
        status: action.action,
        timestamp: action.timestamp,
        note: action.reason || `Seller ${action.action}ed items`,
        updatedBy: action.sellerId?.name || 'Unknown Seller',
        userRole: 'seller',
        items: action.items
      })),

      // Refund history if exists
      ...(order.refundRequest ? [{
        type: 'refund_request',
        status: 'Refund Requested',
        timestamp: order.refundRequest.requestedAt,
        note: order.refundRequest.reason,
        updatedBy: 'Customer',
        userRole: 'customer'
      }] : []),

      ...(order.refundInfo ? [{
        type: 'refund_processed',
        status: 'Refunded',
        timestamp: order.refundInfo.refundedAt,
        note: order.refundInfo.reason,
        updatedBy: 'System',
        amount: order.refundInfo.amount
      }] : [])
    ];

    // Sort by timestamp
    history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return res.json({
      success: true,
      orderId: order._id,
      currentStatus: order.status,
      history: history
    });

  } catch (error) {
    console.error("Error fetching order history:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    const userId = req.user._id;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Check 2-hour cancellation time limit
    const timeCheck = isWithinCancellationPeriod(order.date);
    
    if (!timeCheck.canCancel) {
      return res.status(400).json({
        success: false,
        message: `Orders can only be cancelled within ${CANCELLATION_TIME_LIMIT} hours of placement`,
        hoursPassed: timeCheck.hoursPassed,
        timeExpired: true
      });
    }

    // Only allow cancellation of pending or confirmed orders
    if (!['Pending Confirmation', 'Confirmed'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order in ${order.status} status`
      });
    }

    // Verify user owns the order
    if (order.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this order"
      });
    }

    // Update order status
    order.status = 'Cancelled';
    order.cancellationReason = reason;
    order.cancelledAt = new Date();
    order.cancellationDetails = {
      cancelledAt: new Date(),
      hoursSinceOrder: timeCheck.hoursPassed,
      timeRemaining: timeCheck.timeRemaining,
      reason: reason || 'Cancelled by customer',
      cancelledBy: userId
    };

    // Add to tracking history
    if (!order.tracking) order.tracking = { history: [] };
    order.tracking.history.push({
      status: 'Cancelled',
      timestamp: new Date(),
      note: `Cancelled by customer within ${timeCheck.hoursPassed} hours (${Math.round(timeCheck.timeRemaining * 60)} minutes remaining). Reason: ${reason || 'No reason provided'}`,
      updatedBy: userId
    });

    // Restore product stock
    for (const item of order.items) {
      if (item.product) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: item.quantity }
        });
      }
    }

    await order.save();

    // Notify sellers with time information
    const sellerIds = [...new Set(order.items
      .filter(item => item.product?.sellerId)
      .map(item => item.product.sellerId.toString()))];

    for (const sellerId of sellerIds) {
      await NotificationService.create({
        recipient: sellerId,
        type: 'ORDER_CANCELLED',
        title: 'Order Cancelled',
        message: `Order #${order._id} cancelled within ${timeCheck.hoursPassed} hours of placement`,
        data: {
          orderId: order._id,
          reason,
          cancelledAt: new Date(),
          hoursSinceOrder: timeCheck.hoursPassed,
          timeRemaining: timeCheck.timeRemaining
        }
      });
    }

    return res.json({
      success: true,
      message: "Order cancelled successfully",
      order: {
        _id: order._id,
        status: order.status,
        tracking: order.tracking,
        cancellationDetails: order.cancellationDetails
      }
    });

  } catch (error) {
    console.error("Error cancelling order:", error);
    return res.status(500).json({
      success: false, 
      message: error.message
    });
  }
};
export const getPendingSellerOrders = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "Authentication failed - user not found in token",
      });
    }

    const sellerId = req.user._id;
    console.log("Seller ID from token:", sellerId);

    // Debug: Check how many orders have pending statuses
    const pendingOrderCount = await Order.countDocuments({
      status: { $in: ["Pending Confirmation", "Order Placed"] },
    });
    console.log(`Total pending orders in system: ${pendingOrderCount}`);

    // Find orders pending confirmation with products from this seller
    const pendingOrders = await Order.find({
      status: { $in: ["Pending Confirmation", "Order Placed"] },
    })
      .populate({
        path: "items.product",
        model: "Product",
        match: { sellerId: sellerId },
        select: "name price images category stock sellerId",
      })
      .populate({
        path: "userId",
        model: "User",
        select: "name email phone",
      })
      .sort({ date: -1 });

    console.log(`Found ${pendingOrders.length} orders before filtering`);

    // Filter orders to only include those with products from this seller
    const sellerPendingOrders = pendingOrders.filter((order) =>
      order.items.some((item) => item.product !== null)
    );

    console.log(`Found ${sellerPendingOrders.length} orders after filtering`);

    // Process orders similar to getSellerOrders function
    const processedOrders = sellerPendingOrders.map((order) => {
      const sellerItems = order.items.filter((item) => item.product !== null);

      // Calculate total amount for seller's items
      const total = sellerItems.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
      );

      // Format customer information
      let customerName = "N/A";
      let customerEmail = "N/A";
      let customerPhone = "N/A";
      let shippingAddress = "No address provided";

      if (order.address) {
        customerName = `${order.address.firstName || ""} ${
          order.address.lastName || ""
        }`.trim();
        customerEmail = order.address.email || "N/A";
        customerPhone = order.address.phone || "N/A";
        shippingAddress = `${order.address.street || ""}, ${
          order.address.city || ""
        }, ${order.address.state || ""} ${order.address.zipcode || ""}, ${
          order.address.country || ""
        }`.trim();
      } else if (order.userId) {
        customerName = order.userId.name || "N/A";
        customerEmail = order.userId.email || "N/A";
        customerPhone = order.userId.phone || "N/A";
      }

      return {
        _id: order._id,
        orderNumber: order.orderNumber || order._id,
        createdAt: order.date,
        customer: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          shippingAddress: shippingAddress,
        },
        orderDetails: {
          status: order.status,
          paymentMethod: order.paymentMethod || "Not specified",
          paymentStatus: order.paymentStatus || "Pending",
          items: sellerItems.map((item) => ({
            productId: item.product._id,
            name: item.product.name,
            quantity: item.quantity,
            price: item.product.price,
            total: item.product.price * item.quantity,
            image: item.product.images?.[0] || null,
            currentStock: item.product.stock,
          })),
          total: total,
        },
      };
    });

    // Mark related notifications as read
    try {
      await NotificationService.markAsRead({
        recipient: sellerId,
        type: ["NEW_ORDER"],
        data: {
          orderId: { $in: processedOrders.map((order) => order._id) },
        },
      });
    } catch (error) {
      console.warn("Failed to mark notifications as read:", error);
      // Continue execution - this is not critical
    }

    // Return the pending orders
    return res.json({
      success: true,
      count: processedOrders.length,
      pendingOrders: processedOrders,
    });
  } catch (error) {
    console.error("Error fetching pending orders:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pending orders",
      error: error.message,
    });
  }
};

// Get orders for a specific seller
export const getSellerOrders = async (req, res) => {
  try {
    const sellerId = req.user._id;

    // Find orders containing products from this seller
    const orders = await Order.find()
      .populate({
        path: "items.product",
        model: "Product",
        match: { sellerId: sellerId },
        select: "name price images category sellerId status",
      })
      .populate({
        path: "userId",
        model: "User",
        select: "name email phone",
      })
      .sort({ date: -1 });

    // Filter out orders that don't have any products from this seller
    const sellerOrders = orders.filter((order) =>
      order.items.some((item) => item.product !== null)
    );

    // For each order, include only the items that belong to this seller
    const processedOrders = sellerOrders.map((order) => {
      const sellerItems = order.items.filter((item) => item.product !== null);

      // Calculate total amount for seller's items
      const total = sellerItems.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
      );

      // Format customer address
      const formattedAddress = order.address
        ? `${order.address.street}, ${order.address.city}, ${order.address.state} ${order.address.zipcode}, ${order.address.country}`
        : "No address provided";

      return {
        _id: order._id,
        orderId: order._id,
        orderNumber: order.orderNumber || order._id,
        customer: {
          name: order.address
            ? `${order.address.firstName} ${order.address.lastName}`
            : "N/A",
          email: order.address?.email || "N/A",
          phone: order.address?.phone || "N/A",
          shippingAddress: formattedAddress,
        },
        orderDetails: {
          date: order.date,
          status: order.status,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus || "Pending",
          items: sellerItems.map((item) => ({
            productId: item.product._id,
            name: item.product.name,
            quantity: item.quantity,
            price: item.product.price,
            total: item.product.price * item.quantity,
            image: item.product.images?.[0] || null,
          })),
          total: total,
        },
        lastUpdated: order.updatedAt || order.date,
      };
    });

    // Mark related notifications as read
    try {
      await NotificationService.markAsRead({
        recipient: sellerId,
        type: ["NEW_ORDER", "ORDER_STATUS"],
        data: {
          orderId: { $in: processedOrders.map((order) => order._id) },
        },
      });
    } catch (error) {
      console.warn("Failed to mark notifications as read:", error);
      // Continue execution - this is not critical
    }

    // Send success response with processed orders
    res.json({
      success: true,
      count: processedOrders.length,
      orders: processedOrders,
    });
  } catch (error) {
    console.error("Error fetching seller orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch seller orders",
      error: error.message,
    });
  }
};
export const getSellerOrderAnalytics = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const { period } = req.query; // 'day', 'week', 'month', 'year'

    // Calculate the date range based on the period
    const endDate = new Date();
    let startDate = new Date();

    switch (period) {
      case "day":
        startDate.setDate(startDate.getDate() - 1);
        break;
      case "week":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case "year":
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30); // Default to 30 days
    }

    // Find orders for this seller in the date range
    const orders = await Order.find({
      date: { $gte: startDate, $lte: endDate },
    }).populate({
      path: "items.product",
      match: { sellerId: sellerId },
      select: "name price category sellerId",
    });

    // Filter and process orders
    const sellerOrders = orders.filter((order) =>
      order.items.some((item) => item.product !== null)
    );

    // Calculate analytics
    const analytics = {
      totalOrders: sellerOrders.length,
      totalRevenue: 0,
      ordersByStatus: {},
      topProducts: {},
      dailySales: {},
    };

    // Process each order
    sellerOrders.forEach((order) => {
      // Count orders by status
      if (!analytics.ordersByStatus[order.status]) {
        analytics.ordersByStatus[order.status] = 0;
      }
      analytics.ordersByStatus[order.status]++;

      // Only count completed orders for revenue
      if (["Delivered", "Completed"].includes(order.status)) {
        // Get this seller's items
        const sellerItems = order.items.filter((item) => item.product !== null);

        // Calculate revenue from this order
        const orderRevenue = sellerItems.reduce(
          (sum, item) => sum + item.product.price * item.quantity,
          0
        );

        analytics.totalRevenue += orderRevenue;

        // Track top products
        sellerItems.forEach((item) => {
          const productId = item.product._id.toString();
          if (!analytics.topProducts[productId]) {
            analytics.topProducts[productId] = {
              id: productId,
              name: item.product.name,
              quantity: 0,
              revenue: 0,
            };
          }

          analytics.topProducts[productId].quantity += item.quantity;
          analytics.topProducts[productId].revenue +=
            item.product.price * item.quantity;
        });

        // Track daily sales
        const dateStr = order.date.toISOString().split("T")[0];
        if (!analytics.dailySales[dateStr]) {
          analytics.dailySales[dateStr] = {
            date: dateStr,
            orders: 0,
            revenue: 0,
          };
        }

        analytics.dailySales[dateStr].orders++;
        analytics.dailySales[dateStr].revenue += orderRevenue;
      }
    });

    // Convert objects to arrays for easier client-side rendering
    analytics.topProducts = Object.values(analytics.topProducts)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5); // Top 5 products

    analytics.dailySales = Object.values(analytics.dailySales).sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    return res.json({
      success: true,
      analytics,
    });
  } catch (error) {
    console.error("Error fetching seller analytics:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Process partial order confirmation/rejection by sellers
export const processPartialOrder = async (req, res) => {
  try {
    const { orderId, items, action, reason } = req.body;
    const sellerId = req.user._id;

    if (!["confirm", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be either 'confirm' or 'reject'",
      });
    }

    const order = await Order.findById(orderId).populate({
      path: "items.product",
      select: "sellerId name price stock",
    });

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    // Create a record of seller action if not exists
    if (!order.sellerActions) order.sellerActions = [];

    // Process each item in the request
    for (const itemId of items) {
      const orderItem = order.items.find(
        (item) =>
          item._id.toString() === itemId &&
          item.product.sellerId.toString() === sellerId.toString()
      );

      if (!orderItem) continue;

      if (action === "reject") {
        // Restore stock for rejected items
        await Product.findByIdAndUpdate(orderItem.product._id, {
          $inc: { stock: orderItem.quantity },
        });

        // Mark item as rejected
        orderItem.status = "Rejected";
      } else {
        // Mark item as confirmed
        orderItem.status = "Confirmed";
      }
    }

    // Record the action
    order.sellerActions.push({
      sellerId,
      action,
      reason,
      items: items,
      timestamp: new Date(),
    });

    await order.save();

    // Notify customer
    await NotificationService.create({
      recipient: order.userId,
      type: "ORDER_STATUS",
      title: `Order Items ${action === "confirm" ? "Confirmed" : "Rejected"}`,
      message: `Some items in your order #${order._id} have been ${
        action === "confirm" ? "confirmed" : "rejected"
      } by the seller.`,
      data: {
        orderId: order._id,
        status: order.status,
        items: items,
        reason: reason,
      },
    });

    return res.json({
      success: true,
      message: `Items have been ${action}ed successfully`,
      order,
    });
  } catch (error) {
    console.error(`Error processing partial order:`, error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
// Place a new order
export const placeOrder = async (req, res) => {
  try {
    const { address, items, amount, paymentMethod } = req.body;
    const userId = req.user._id;

    const populatedItems = await Promise.all(
      items.map(async (item) => {
        try {
          const product = await Product.findById(item.productId);
          if (!product) {
            console.warn("Product not found:", item.productId);
            return null;
          }

          if (product.stock < item.quantity) {
            throw new Error(`Not enough stock for product: ${product.name}`);
          }

          product.stock -= item.quantity;
          await product.save();

          return {
            product: product._id,
            quantity: item.quantity,
            name: product.name,
            price: product.price,
            sellerId: product.sellerId, // Add sellerId for notifications
            image:
              product.images && product.images.length > 0
                ? product.images[0]
                : "",
            status: "Pending Confirmation",
          };
        } catch (error) {
          console.error("Error processing item:", item, error);
          return null;
        }
      })
    );

    // Filter out any null items
    const finalItems = populatedItems.filter((i) => i !== null);

    console.log("Populated items:", finalItems);

    // Build the order data
    const orderData = {
      userId,
      address,
      items: finalItems,
      amount,
      paymentMethod,
      status: "Pending Confirmation",
      date: new Date(),
    };

    // Create the new order document
    const newOrder = new Order(orderData);
    await newOrder.save();

    // Notify customer about order placement
    await NotificationService.createOrderNotification(
      userId,
      newOrder,
      "ORDER_STATUS"
    );

    // Group items by seller for notifications
    const sellerItems = {};
    for (const item of finalItems) {
      const sellerId = item.sellerId.toString();
      if (!sellerItems[sellerId]) {
        sellerItems[sellerId] = [];
      }
      sellerItems[sellerId].push(item);
    }

    // Notify each seller about their items in the order
    for (const [sellerId, items] of Object.entries(sellerItems)) {
      await NotificationService.create({
        recipient: sellerId,
        type: "NEW_ORDER",
        title: "New Order Received",
        message: `You have received a new order containing ${items.length} item(s)`,
        data: {
          orderId: newOrder._id,
          items: items,
        },
      });
    }

    console.log("New order saved:", newOrder);

    res.json({
      success: true,
      message: "Order Placed Successfully",
      order: newOrder,
    });
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Fetch orders for the logged-in user
export const userOrders = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. User not found in token.",
      });
    }

    const userId = req.user._id;

    // Get basic order data with lean() for better performance
    const orders = await Order.find({ userId })
      .populate({
        path: "items.product",
        select: "name price images sellerId",
      })
      .sort({ date: -1 })
      .lean();

    if (orders.length === 0) {
      return res.json({ success: true, orders: [] });
    }

    // Process each order
    const detailedOrders = orders.map((order) => {
      // Calculate order totals
      const orderTotal = order.items.reduce(
        (sum, item) => sum + (item.product?.price || 0) * item.quantity,
        0
      );

      // Format order details
      return {
        _id: order._id,
        orderNumber: order.orderNumber || order._id,
        date: order.date,
        status: order.status,
        orderDetails: {
          items: order.items.map((item) => ({
            productId: item.product?._id,
            name: item.product?.name || "Product Unavailable",
            quantity: item.quantity,
            price: item.product?.price || 0,
            total: (item.product?.price || 0) * item.quantity,
            image: item.product?.images?.[0] || null,
            sellerId: item.product?.sellerId,
          })),
          subtotal: orderTotal,
          total: orderTotal + (order.shippingFee || 0),
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus || "Pending",
        },
        shipping: {
          address: order.address
            ? {
                street: order.address.street,
                city: order.address.city,
                state: order.address.state,
                zipcode: order.address.zipcode,
                country: order.address.country,
              }
            : null,
          fee: order.shippingFee || 0,
          status: order.status, // Just use the order status directly
        },
        timestamps: {
          ordered: order.date,
          updated: order.updatedAt || order.date,
        },
      };
    });

    // Mark notifications as read
    try {
      await NotificationService.markAsRead({
        recipient: userId,
        type: ["ORDER_STATUS"],
        data: {
          orderId: { $in: detailedOrders.map((order) => order._id) },
        },
      });
    } catch (error) {
      console.warn("Failed to mark notifications as read:", error);
      // Continue execution - this is not critical
    }

    return res.json({
      success: true,
      count: detailedOrders.length,
      orders: detailedOrders,
    });
  } catch (error) {
    console.error("Error fetching user orders:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
// Fetch all orders (admin feature)
export const allOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ date: -1 });
    res.json({ success: true, orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSellerOrderManagement = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const { 
      status,
      sortBy = 'date', 
      sortDir = 'desc', 
      page = 1, 
      limit = 10,
      search,
      dateFrom,
      dateTo
    } = req.query;
    
    // Pagination setup
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Base query - get orders with seller's products
    let aggregatePipeline = [
      // Match orders that have at least one item from this seller
      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "products"
        }
      },
      {
        $match: {
          "products.sellerId": new mongoose.Types.ObjectId(sellerId)
        }
      },
      // Date filtering
      ...(dateFrom || dateTo ? [{
        $match: {
          date: {
            ...(dateFrom && { $gte: new Date(dateFrom) }),
            ...(dateTo && { $lte: new Date(dateTo) })
          }
        }
      }] : []),
      // Status filtering
      ...(status && status !== 'All' ? [{
        $match: { status }
      }] : []),
      // Search functionality
      ...(search ? [{
        $match: {
          $or: [
            { orderNumber: new RegExp(search, 'i') },
            { "address.firstName": new RegExp(search, 'i') },
            { "address.lastName": new RegExp(search, 'i') },
            { "address.email": new RegExp(search, 'i') }
          ]
        }
      }] : [])
    ];
    
    // Count total matching orders
    const countPipeline = [...aggregatePipeline, { $count: "total" }];
    const countResult = await Order.aggregate(countPipeline);
    const totalOrders = countResult.length > 0 ? countResult[0].total : 0;
    
    // If no orders found, return empty array but with success: true
    if (totalOrders === 0) {
      return res.status(200).json({
        success: true,
        message: "No orders found matching your criteria",
        orders: [],
        pagination: {
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: 0
        },
        filters: {
          status,
          dateFrom,
          dateTo,
          search
        }
      });
    }
    
    // Sorting
    const sortStage = {};
    sortStage[sortBy] = sortDir === 'asc' ? 1 : -1;
    
    // Complete the pipeline with sort, skip, limit and lookups
    aggregatePipeline = [
      ...aggregatePipeline,
      { $sort: sortStage },
      { $skip: skip },
      { $limit: parseInt(limit) },
      // Populate customer info
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userInfo"
        }
      },
      // Populate product details for this seller only
      {
        $lookup: {
          from: "products",
          let: { itemProducts: "$items.product" },
          pipeline: [
            { 
              $match: { 
                $and: [
                  { $expr: { $in: ["$_id", "$$itemProducts"] } },
                  { sellerId: new mongoose.Types.ObjectId(sellerId) }
                ]
              } 
            },
            { $project: { name: 1, price: 1, images: 1, stock: 1 } }
          ],
          as: "sellerProducts"
        }
      }
    ];
    
    const orders = await Order.aggregate(aggregatePipeline);
    
    // Process orders to include only seller's items and calculate seller's totals
    const processedOrders = orders.map((order) => {
      try {
        // Match products with order items
        const sellerItems = order.items.filter(item => {
          return order.sellerProducts.some(product => 
            product._id.toString() === item.product.toString()
          );
        });
        
        // Calculate seller's total for this order
        const sellerTotal = sellerItems.reduce((sum, item) => {
          const product = order.sellerProducts.find(p => 
            p._id.toString() === item.product.toString()
          );
          return sum + (product ? product.price * item.quantity : 0);
        }, 0);
        
        // Format customer info
        const customer = {
          name: order.address 
            ? `${order.address.firstName || ''} ${order.address.lastName || ''}`.trim()
            : (order.userInfo[0]?.name || "Guest Customer"),
          email: order.address?.email || order.userInfo[0]?.email || "N/A",
          phone: order.address?.phone || order.userInfo[0]?.phone || "N/A",
        };
        
        // Format items with product details
        const formattedItems = sellerItems.map(item => {
          const product = order.sellerProducts.find(p => 
            p._id.toString() === item.product.toString()
          );
          
          return {
            productId: item.product,
            name: product?.name || "Product not found",
            quantity: item.quantity,
            price: product?.price || 0,
            total: (product?.price || 0) * item.quantity,
            image: product?.images?.[0] || null,
            itemStatus: item.status || order.status
          };
        });
        
        // Format address
        const address = order.address 
          ? `${order.address.street}, ${order.address.city}, ${order.address.state} ${order.address.zipcode}, ${order.address.country}`
          : "No address provided";
        
        return {
          _id: order._id,
          orderNumber: order.orderNumber || order._id,
          date: order.date,
          status: order.status,
          customer,
          address,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus || "Pending",
          items: formattedItems,
          itemCount: formattedItems.length,
          total: sellerTotal,
          shipping: {
            status: order.status
          },
          lastUpdated: order.updatedAt || order.date,
          needsAction: ['Order Placed', 'Pending Confirmation'].includes(order.status)
        };
      } catch (error) {
        console.error(`Error processing order ${order._id}:`, error);
        return null;
      }
    });
    
    // Filter out any errors
    const finalOrders = processedOrders.filter(order => order !== null);
    
    // If all orders had processing errors, return empty array instead of error
    if (finalOrders.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No valid orders found",
        orders: [],
        pagination: {
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: 0
        },
        filters: {
          status,
          dateFrom,
          dateTo,
          search
        }
      });
    }
    
    // Return the processed orders with pagination info
    return res.json({
      success: true,
      orders: finalOrders,
      pagination: {
        total: totalOrders,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalOrders / parseInt(limit))
      },
      filters: {
        status,
        dateFrom,
        dateTo,
        search
      }
    });
  } catch (error) {
    console.error("Error fetching seller order management data:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while retrieving your orders. Please try again later."
    });
  }
};  