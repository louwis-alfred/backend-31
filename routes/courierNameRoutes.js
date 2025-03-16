import express from "express";
import { getCourierName } from "../controllers/courierNameController.js";

const router = express.Router();

// Public endpoint - no auth required for maximum compatibility
router.get("/:orderId", getCourierName);

export default router;