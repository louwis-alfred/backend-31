import express from "express";
import mongoose from "mongoose"; // Add this import
import Logistics from "../models/logisticsModel.js";
import upload from "../middleware/multer.js";
import { getFilteredOrders, getOrdersByStatus } from '../controllers/filterController.js';
import {
  placeOrder,
  allOrders,
  userOrders,
  getSellerOrders,
  getCourierInfoForOrders,
  sellerConfirmOrder,
  getPendingSellerOrders,
  processPartialOrder,
  getUnifiedCourierStatus,
  getCourierPanelStatus,
 cancelOrder, getOrderHistory, getSellerOrderManagement
} from "../controllers/orderController.js";
import { authUser, authSeller } from "../middleware/authRoles.js";

const orderRouter = express.Router();

// Admin Features
orderRouter.post('/cancel', authUser, cancelOrder);
// Payment Features
orderRouter.get("/check-logistics/:orderId", authUser, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    console.log("[DEBUG] Checking logistics for order:", orderId);

    const orderObjectId = new mongoose.Types.ObjectId(orderId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const logisticsEntry = await Logistics.findOne({
      $or: [
        { orderId: orderObjectId },
        { _id: orderObjectId },
        { userId: userObjectId },
      ],
    })
      .populate("courierId")
      .lean();

    if (!logisticsEntry) {
      return res.json({
        success: true,
        found: false,
        status: "Processing",
        courierName: "Not Assigned",
      });
    }

    res.json({
      success: true,
      found: true,
      status: logisticsEntry.status || "Processing",
      courierName: logisticsEntry.courierId?.name || "Not Assigned",
      logisticsData: logisticsEntry,
    });
  } catch (error) {
    console.error("[ERROR] Checking order logistics:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});
orderRouter.post("/place", authUser, placeOrder);
orderRouter.get("/courier-panel-status/:orderId", getCourierPanelStatus);
// Seller Features
orderRouter.get("/courier-status/:orderId", authUser, getUnifiedCourierStatus);
orderRouter.get("/seller-orders", authUser, authSeller, getSellerOrders);
orderRouter.post("/confirm-reject", authUser, authSeller, sellerConfirmOrder);
orderRouter.post("/process-partial", authUser, authSeller, processPartialOrder);
orderRouter.get('/history/:orderId', authUser, getOrderHistory)
orderRouter.get("/seller/management", authUser, getSellerOrderManagement);
// User Features
orderRouter.get("/userorders", authUser, userOrders);
orderRouter.get(
  "/pending-confirmation",
  authUser,
  authSeller,
  getPendingSellerOrders
);
// Courier Information Endpoint
orderRouter.post("/courier-info", authUser, getCourierInfoForOrders);

export default orderRouter;
