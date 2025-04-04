import express from "express";
import {
  placeOrder,
  allOrders,
  userOrders,
  getSellerOrders,
  sellerConfirmOrder,
  getPendingSellerOrders,
  processPartialOrder,
 cancelOrder, getOrderHistory, getSellerOrderManagement
} from "../controllers/orderController.js";
import { authUser, authSeller } from "../middleware/authRoles.js";

const orderRouter = express.Router();

// Admin Features
orderRouter.post('/cancel', authUser, cancelOrder);
orderRouter.post("/place", authUser, placeOrder);
// Seller Features
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

export default orderRouter;
