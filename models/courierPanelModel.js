import mongoose from "mongoose";
import { orderItemSchema } from "./orderModel.js";

const courierPanelSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
  },
  items: {
    type: [orderItemSchema],
    required: true,
  },
  amount: { type: Number, required: true },
  address: { type: Object, required: true },
  status: { type: String, default: "Assigned to Courier" },
  paymentMethod: { type: String, required: true },
  payment: { type: Boolean, default: false },
  date: { type: Number, required: true },
  courierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Courier",
    default: null,
  },
});

const CourierPanel = mongoose.model('courierpanel', courierPanelSchema, 'courierpanel');

export default CourierPanel;
