import express from "express";
import {
  getStatusByOrderId,
  getStatusByCourierId,
  getUnifiedCourierStatus, getCourierName
} from "../controllers/courierPanelController.js";

import { authUser, authSeller } from "../middleware/authRoles.js";

const router = express.Router();
router.get("/courier-name/:orderId", authUser,getCourierName);
// Route to get status by orderId
router.get("/status/:orderId", authUser, getStatusByOrderId);

// Route to get status by courierId
router.get("/status/courier/:courierId", authUser, getStatusByCourierId);

// New endpoint for getting unified courier status with more details
router.get("/unified-status/:orderId", authUser, getUnifiedCourierStatus);

export default router;
