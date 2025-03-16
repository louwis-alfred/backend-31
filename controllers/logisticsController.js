import mongoose from "mongoose";
import Logistics from "../models/logisticsModel.js";
import CourierPanel from "../models/courierPanelModel.js";
import Order from "../models/orderModel.js";
import Courier from "../models/courierModel.js";

// Get unified status information for an order
export const getUnifiedStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const objectId = mongoose.Types.ObjectId.isValid(orderId)
      ? new mongoose.Types.ObjectId(orderId)
      : null;

    if (!objectId) {
      return res.json({
        success: true,
        status: "Processing",
        courierName: "Not Assigned",
        source: "default",
        reason: "Invalid order ID format",
      });
    }

    console.log(`[UNIFIED] Looking for status of order ID: ${orderId}`);

    // Check CourierPanel first (higher precedence)
    const courierPanel = await CourierPanel.findOne({
      $or: [{ orderId: objectId }, { _id: objectId }],
    })
      .populate("courierId", "name")
      .lean();

    // Then check Logistics
    const logistics = await Logistics.findOne({
      $or: [{ orderId: objectId }, { _id: objectId }],
    })
      .populate("courierId", "name")
      .lean();

    console.log(
      "[UNIFIED] Found in CourierPanel:",
      courierPanel ? "Yes" : "No"
    );
    console.log("[UNIFIED] Found in Logistics:", logistics ? "Yes" : "No");

    // If found in courierPanel, that takes precedence
    if (courierPanel) {
      console.log("[UNIFIED] Using CourierPanel data");
      return res.json({
        success: true,
        status: courierPanel.status || "Assigned to Courier",
        courierName: courierPanel.courierId?.name || "Not Assigned",
        source: "courierPanel",
      });
    }

    // Otherwise use logistics if available
    if (logistics) {
      console.log("[UNIFIED] Using Logistics data");
      return res.json({
        success: true,
        status: logistics.status || "Shipped",
        courierName: logistics.courierId?.name || "Not Assigned",
        source: "logistics",
      });
    }

    // Default response if not found in either collection
    console.log("[UNIFIED] No data found, using default");
    return res.json({
      success: true,
      status: "Processing",
      courierName: "Not Assigned",
      source: "default",
    });
  } catch (error) {
    console.error("[ERROR] Unified status check:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// Get courier information for a list of order IDs
export const getCourierInfoForOrders = async (req, res) => {
  try {
    const { orderIds } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Valid order IDs array required" });
    }

    console.log("[COURIER-INFO] Looking for info for orders:", orderIds);

    // Convert all IDs to proper ObjectId format if they're valid
    const validOrderIds = orderIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (validOrderIds.length === 0) {
      return res.json({ success: true, courierInfo: [] });
    }

    // Create a result array to store info for each order ID
    const courierInfo = [];

    // For each order ID, check both collections
    for (const orderId of validOrderIds) {
      // First check CourierPanel (higher precedence)
      const courierPanel = await CourierPanel.findOne({
        orderId: orderId,
      })
        .populate("courierId", "name")
        .lean();

      if (courierPanel) {
        courierInfo.push({
          orderId: orderId.toString(),
          courierName: courierPanel.courierId?.name || "Assigned to Courier",
          status: courierPanel.status || "Assigned to Courier",
          source: "courierPanel",
        });
        continue; // Skip to next order
      }

      // Then check Logistics if not found in CourierPanel
      const logistics = await Logistics.findOne({
        orderId: orderId,
      })
        .populate("courierId", "name")
        .lean();

      if (logistics) {
        courierInfo.push({
          orderId: orderId.toString(),
          courierName: logistics.courierId?.name || "Not Assigned",
          status: logistics.status || "Shipped",
          source: "logistics",
        });
        continue; // Skip to next order
      }

      // If not found in either collection, add default info
      courierInfo.push({
        orderId: orderId.toString(),
        courierName: "Not Assigned",
        status: "Processing",
        source: "default",
      });
    }

    console.log(
      `[COURIER-INFO] Returning info for ${courierInfo.length} orders`
    );
    res.json({ success: true, courierInfo });
  } catch (error) {
    console.error("[ERROR] Getting courier info for orders:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const debugLogistics = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find all logistics entries
    const allLogistics = await Logistics.find().lean();

    // Find specific logistics entry
    const specificLogistics = await Logistics.findOne({
      $or: [
        { orderId: new mongoose.Types.ObjectId(orderId) },
        { "items.product": new mongoose.Types.ObjectId(orderId) },
      ],
    }).lean();

    console.log("[Debug] All logistics entries count:", allLogistics.length);
    console.log(
      "[Debug] Specific logistics entry:",
      JSON.stringify(specificLogistics, null, 2)
    );

    return res.json({
      success: true,
      debug: {
        totalLogistics: allLogistics.length,
        specificLogistics,
        sampleLogistics: allLogistics[0], // Show first logistics entry as sample
      },
    });
  } catch (error) {
    console.error("[Error] Debug logistics:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
