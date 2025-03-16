import mongoose from "mongoose";

const investmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "accepted", "completed", "cancelled"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      required: true,
    },
    payment: {
      type: Boolean,
      default: false,
    },
    // Payment confirmation details
    paymentConfirmedAt: {
      type: Date,
    },
    paymentDetails: {
      receiptNumber: String,
      transactionId: String,
      paymentMode: String, // e.g., 'gcash', 'bank_transfer'
      confirmedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      confirmationDate: Date,
      notes: String,
      evidenceUrl: String, // URL to receipt image or payment proof
      additionalInfo: mongoose.Schema.Types.Mixed,
    },
    // Investment lifecycle tracking
    sellerAcceptedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    completionNotes: {
      type: String,
    },
    // Flag to track if this investment has been counted in campaign funding
    countedInFunding: {
      type: Boolean,
      default: false,
    },
    // Expected returns calculation
    expectedReturn: {
      type: Number,
      default: 0,
    },
    expectedReturnPercentage: {
      type: Number,
      default: 0,
    },
    actualReturn: {
      type: Number,
    },
    returnPaidDate: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Add index for faster queries
investmentSchema.index({ userId: 1, campaignId: 1 });
investmentSchema.index({ status: 1 });
investmentSchema.index({ paymentConfirmedAt: 1 });
investmentSchema.index({ completedAt: 1 });

const Investment = mongoose.model("Investment", investmentSchema);
export default Investment;
