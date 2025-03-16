import Notification from "../models/notificationModel.js";
import userModel from "../models/userModel.js";

class NotificationService {
  static async create(data) {
    try {
      // If actorId is provided but not actorName, fetch the user data
      if (data.data?.actorId && !data.data?.actorName) {
        const actor = await userModel
          .findById(data.data.actorId)
          .select("name avatar");
        if (actor) {
          data.data.actorName = actor.name;
          data.data.actorAvatar = actor.avatar;
        }
      }

      const notification = new Notification(data);
      await notification.save();
      return notification;
    } catch (error) {
      console.error("Notification creation failed:", error);
      throw error;
    }
  }

  static async createActionNotification({
    recipient,
    actor,
    title,
    message,
    actionType,
    actionUrl,
    entityId,
    entityType,
  }) {
    return this.create({
      recipient,
      type: actionType,
      title,
      message,
      data: {
        actionUrl,
        actionType,
        entityId,
        entityType,
        actorId: actor._id,
        actorName: actor.name,
        actorAvatar: actor.avatar,
      },
    });
  }

    static async createOrderNotification(userId, order, type = "ORDER_STATUS") {
    // Default values
    let title = "Order Update";
    let message = `Your order #${order._id} status has been updated to ${order.status}`;
    
    // Customize message based on notification type
    switch (type) {
      case "ORDER_CONFIRMED":
        title = "Order Confirmed";
        message = `Your order #${order._id} has been confirmed by the seller and is being processed.`;
        break;
      case "ORDER_REJECTED":
        title = "Order Rejected";
        message = `We're sorry, your order #${order._id} has been rejected by the seller.`;
        break;
      case "NEW_ORDER":
        title = "Order Placed Successfully";
        message = `Your order #${order._id} has been placed and is awaiting seller confirmation.`;
        break;
      case "PLACED":
        title = "Order Placed";
        message = `Your order #${order._id} has been successfully placed.`;
        break;
    }
    
    return this.create({
      recipient: userId,
      type,  // This will use the passed type value (ORDER_CONFIRMED, ORDER_REJECTED, etc.)
      title,
      message,
      data: {
        orderId: order._id,
        status: order.status,
        actionUrl: `/orders/${order._id}`,
        actionType: "VIEW_ORDER",
      },
    });
  }

  static async createTradeNotification(userId, trade, action) {
    return this.create({
      recipient: userId,
      type: "TRADE_UPDATE",
      title: "Trade Update",
      message: `Your trade has been ${action}`,
      data: { tradeId: trade._id, status: trade.status },
    });
  }

  static async createInvestmentNotification(userId, investment, action) {
    return this.create({
      recipient: userId,
      type: "INVESTMENT_UPDATE",
      title: "Investment Update",
      message: `Your investment has been ${action}`,
      data: { investmentId: investment._id, status: investment.status },
    });
  }

  static async createPaymentNotification(userId, payment) {
    return this.create({
      recipient: userId,
      type: "PAYMENT_CONFIRMATION",
      title: "Payment Confirmed",
      message: `Your payment of ₱${payment.amount} has been confirmed`,
      data: { paymentId: payment._id, amount: payment.amount },
    });
  }

  /**
   * Mark notifications as read based on query parameters
   * @param {Object} query - Query parameters to find notifications
   * @param {string|ObjectId} query.recipient - User ID of the recipient (required)
   * @param {string|string[]} [query.type] - Notification type or array of types
   * @param {Object} [query.data] - Data fields to match (e.g., orderId)
   * @returns {Promise<Object>} Result with count of modified documents
   */
  static async markAsRead(query) {
    try {
      if (!query || !query.recipient) {
        throw new Error('Recipient is required for marking notifications as read');
      }
      
      // Build the filter for findAndUpdate
      const filter = { 
        recipient: query.recipient,
        read: false // Only update unread notifications
      };
      
      // Add type filter if specified
      if (query.type) {
        filter.type = Array.isArray(query.type) ? { $in: query.type } : query.type;
      }
      
      // Add data field filters if specified
      if (query.data) {
        for (const [key, value] of Object.entries(query.data)) {
          filter[`data.${key}`] = value;
        }
      }
      
      // Update matching notifications
      const result = await Notification.updateMany(
        filter,
        { $set: { read: true } }
      );
      
      return {
        success: true,
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
      };
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      throw error;
    }
  }
}

export default NotificationService;