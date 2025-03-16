import mongoose from "mongoose";

const tradeAttachmentSchema = new mongoose.Schema({
  tradeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Trade",
    required: true,
  },
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "TradeMessage",
    required: true,
  },
  type: {
    type: String,
    enum: ["image", "document", "receipt"],
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  name: String,
  size: Number,
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("TradeAttachment", tradeAttachmentSchema);
