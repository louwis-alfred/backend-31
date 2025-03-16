import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  type: {
    type: String,
    enum: [
      "ORDER_STATUS",
      "TRADE_UPDATE",
      "INVESTMENT_UPDATE",
      "PRODUCT_PURCHASE",
      "PAYMENT_CONFIRMATION",
      "CAMPAIGN_UPDATE",
      "NEW_QUESTION",
      "NEW_REPLY",
      'ORDER_CONFIRMED', // Add this
      'ORDER_REJECTED',  // Add this
      "PLACED", // Add this
      "NEW_ORDER", // And this (used in other places)
    ],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  data: {
    type: mongoose.Schema.Types.Mixed, // For additional data
  },
  read: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for faster queries
notificationSchema.index({ recipient: 1, read: 1 });
notificationSchema.index({ createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
