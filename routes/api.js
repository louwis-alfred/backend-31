import express from "express";
import mongoose from "mongoose";
import CourierPanel from "../models/courierPanelModel.js";

const router = express.Router();

// Get courier status endpoint
router.get("/courier-status/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format"
      });
    }
    
    const orderObjectId = new mongoose.Types.ObjectId(orderId);
    
    // Find the order in CourierPanel
    const courierPanel = await CourierPanel.findOne({
      orderId: orderObjectId,
      // Only get entries that have been assigned to a courier
      courierId: { $exists: true, $ne: null }
    }).lean();
    
    if (!courierPanel) {
      return res.json({
        success: false,
        orderId: orderId,
        message: "No courier assignment found for this order",
        source: "none"
      });
    }
    
    // Get the status based on courier assignment
    let displayStatus = courierPanel.status;
    
    // Special handling for courier statuses
    if (displayStatus === "Processing" && courierPanel.courierId) {
      // If it's assigned but still shows as processing
      const courier = await Courier.findById(courierPanel.courierId);
      displayStatus = courier ? `Assigned to Courier ${courier.name}` : "Assigned to Courier";
    }
    
    // Return the status information with all relevant fields
    return res.json({
      success: true,
      orderId: orderId,
      status: displayStatus,
      courierId: courierPanel.courierId,
      paymentMethod: courierPanel.paymentMethod,
      payment: courierPanel.payment,
      source: "courierPanel"
    });
    
  } catch (error) {
    console.error(`Error fetching courier status: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Error retrieving courier status",
      error: error.message
    });
  }
});

export default router;