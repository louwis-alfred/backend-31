import express from "express";
import { authUser } from "../middleware/authRoles.js";
import Logistics from "../models/logisticsModel.js";
import CourierPanel from "../models/courierPanelModel.js";
import mongoose from "mongoose";
import Order from "../models/orderModel.js"; // Add this import
import * as logisticsController from "../controllers/logisticsController.js"; // Import controllers

const logisticsRouter = express.Router();

// Connect controller to route for courier info
logisticsRouter.post(
  "/courier-info",
  authUser,
  logisticsController.getCourierInfoForOrders
);

// Use the controller for unified status
logisticsRouter.get(
  "/unified-status/:orderId",
  authUser,
  logisticsController.getUnifiedStatus
);

// Debug endpoint for order status
logisticsRouter.get("/debug/:orderId", authUser, async (req, res) => {
  try {
    const { orderId } = req.params;
    const logistics = await Logistics.findOne({
      orderId: new mongoose.Types.ObjectId(orderId),
    }).populate("courierId", "name");

    // Log for debugging
    console.log("[DEBUG] Looking for logistics entry with orderId:", orderId);
    console.log("[DEBUG] Found logistics:", logistics);

    if (!logistics) {
      return res.json({
        success: true,
        status: "Processing",
        courierName: "Not Assigned",
        source: "default",
      });
    }

    res.json({
      success: true,
      status: logistics.status || "Processing",
      courierName: logistics.courierId?.name || "Not Assigned",
      source: "logistics",
    });
  } catch (error) {
    console.error("[ERROR] Fetching logistics status:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add this helper endpoint to verify data
logisticsRouter.get("/check-status/:orderId", authUser, async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log("[DEBUG] Searching for orderId:", orderId);

    // Find all logistics entries (for debugging)
    const allLogistics = await Logistics.find().lean();
    console.log("[DEBUG] Total logistics entries found:", allLogistics.length);

    // Find specific logistics entry with safety check
    const logistics = await Logistics.findOne({
      orderId: new mongoose.Types.ObjectId(orderId),
    }).populate("courierId", "name");

    console.log("[DEBUG] Found logistics:", logistics ? "Yes" : "No");

    // If not found, let's check if the orderId exists in a different format
    if (!logistics) {
      const alternateSearch = await Logistics.find({}).lean();
      console.log(
        "[DEBUG] All logistics entries:",
        JSON.stringify(
          alternateSearch.map((l) => ({
            orderId: l.orderId ? l.orderId.toString() : "No orderId",
            status: l.status || "No status",
          })),
          null,
          2
        )
      );
    }

    // Add safety check for mapping orderIds
    const safeOrderIds = allLogistics
      .filter((l) => l && l.orderId) // Filter out entries without orderId
      .map((l) => l.orderId.toString());

    res.json({
      success: true,
      found: !!logistics,
      logistics: logistics,
      totalEntries: allLogistics.length,
      debug: {
        searchedOrderId: orderId,
        allOrderIds: safeOrderIds,
        invalidEntries: allLogistics.filter((l) => !l.orderId).length,
      },
    });
  } catch (error) {
    console.error("[ERROR] Checking logistics status:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      stack: error.stack,
      debug: {
        orderId: req.params.orderId,
      },
    });
  }
});

// New endpoint to diagnose and repair mismatched logistics entries
logisticsRouter.get("/repair-connections", authUser, async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all orders for this user
    const orders = await Order.find({ userId }).lean();

    // Get all logistics entries
    const logisticsEntries = await Logistics.find({}).lean();

    console.log(`[REPAIR] Found ${orders.length} orders for user`);
    console.log(
      `[REPAIR] Found ${logisticsEntries.length} total logistics entries`
    );

    let repaired = 0;
    let matchedByOrderId = 0;
    let matchedByItems = 0;

    // For each logistics entry, try to find and associate with an order
    for (const logistics of logisticsEntries) {
      // Check if this logistics entry already has a valid orderId
      if (logistics.orderId) {
        const orderIdStr = logistics.orderId.toString();

        // Try to find matching order
        const matchingOrder = orders.find(
          (order) => order._id.toString() === orderIdStr
        );

        if (matchingOrder) {
          console.log(
            `[REPAIR] Logistics entry ${logistics._id} already correctly matched to order ${matchingOrder._id}`
          );
          matchedByOrderId++;
          continue;
        }
      }

      // If no orderId match, try matching by userId and items
      if (
        logistics.userId &&
        logistics.userId.toString() === userId.toString()
      ) {
        // Try to match by comparing items - find an order with similar items
        const matchingOrder = orders.find((order) => {
          // Compare order items and logistics items
          const orderProductIds = order.items
            .map((item) => (item.product ? item.product.toString() : null))
            .filter(Boolean);

          const logisticsProductIds = logistics.items
            .map((item) => (item.product ? item.product.toString() : null))
            .filter(Boolean);

          // Check if there's any overlap in product IDs
          return orderProductIds.some((id) => logisticsProductIds.includes(id));
        });

        if (matchingOrder) {
          console.log(
            `[REPAIR] Found matching order ${matchingOrder._id} for logistics entry ${logistics._id} by products`
          );

          // Update this logistics entry to set the correct orderId
          await Logistics.findByIdAndUpdate(logistics._id, {
            orderId: matchingOrder._id,
          });

          repaired++;
          matchedByItems++;
        }
      }
    }

    res.json({
      success: true,
      message: `Repair completed. Fixed ${repaired} logistics entries.`,
      stats: {
        totalOrders: orders.length,
        totalLogistics: logisticsEntries.length,
        alreadyMatched: matchedByOrderId,
        repairedByItems: matchedByItems,
        unmatchable:
          logisticsEntries.length - matchedByOrderId - matchedByItems,
      },
    });
  } catch (error) {
    console.error("[ERROR] During repair:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// New endpoint to show the detailed logistics entries for debugging
logisticsRouter.get("/check-courier/:orderId", authUser, async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find logistics entries with both direct and item-based matching
    const orderObjectId = new mongoose.Types.ObjectId(orderId);

    // Try to find logistics entries
    const logistics = await Logistics.findOne({
      orderId: orderObjectId,
    })
      .populate("courierId")
      .lean();

    // Also try to find in CourierPanel
    const courierPanel = await CourierPanel.findOne({
      orderId: orderObjectId,
    })
      .populate("courierId")
      .lean();

    res.json({
      success: true,
      logistics,
      courierPanel,
    });
  } catch (error) {
    console.error("[ERROR] Checking courier details:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add a simple data import endpoint to sync data between collections
logisticsRouter.get("/sync-collections", authUser, async (req, res) => {
  try {
    // Get all logistics entries without orderId
    const logisticsWithoutOrderId = await Logistics.find({
      $or: [{ orderId: { $exists: false } }, { orderId: null }],
    });

    // Get all orders for reference
    const allOrders = await Order.find({}).lean();

    console.log(
      `Found ${logisticsWithoutOrderId.length} logistics entries without orderId`
    );

    let fixed = 0;

    // Try to match each logistics entry with an order
    for (const logistics of logisticsWithoutOrderId) {
      // Try to match by userId and similar items
      const matchingOrder = allOrders.find(
        (order) =>
          order.userId.toString() === logistics.userId.toString() &&
          // Check if any items match between order and logistics
          order.items.some((orderItem) =>
            logistics.items.some(
              (logisticItem) =>
                logisticItem.product.toString() === orderItem.product.toString()
            )
          )
      );

      if (matchingOrder) {
        console.log(
          `Found matching order ${matchingOrder._id} for logistics ${logistics._id}`
        );
        // Update logistics with the matched orderId
        await Logistics.findByIdAndUpdate(logistics._id, {
          orderId: matchingOrder._id,
        });
        fixed++;
      }
    }

    res.json({
      success: true,
      message: `Fixed ${fixed} of ${logisticsWithoutOrderId.length} logistics entries`,
    });
  } catch (error) {
    console.error("[ERROR] Syncing collections:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

logisticsRouter.get("/repair-data", authUser, async (req, res) => {
  try {
    // Get all logistics entries
    const allLogistics = await Logistics.find().lean();
    console.log(`Found ${allLogistics.length} total logistics entries`);

    // Get all orders
    const allOrders = await Order.find().lean();
    console.log(`Found ${allOrders.length} total orders`);

    let fixedCount = 0;

    // For logistics entries without proper orderId
    for (const logistics of allLogistics) {
      if (!logistics.orderId) {
        // Try to find matching order by userId and items
        const matchingOrder = allOrders.find(order => {
          // Match by user ID
          if (order.userId.toString() !== logistics.userId.toString()) {
            return false;
          }
          
          // Try to match by products
          const logisticsProductIds = logistics.items
            .map(item => item.product ? item.product.toString() : null)
            .filter(Boolean);
          
          const orderProductIds = order.items
            .map(item => item.product ? item.product.toString() : null)
            .filter(Boolean);
          
          return logisticsProductIds.some(id => orderProductIds.includes(id));
        });
        
        if (matchingOrder) {
          console.log(`Fixing logistics entry ${logistics._id} to connect with order ${matchingOrder._id}`);
          await Logistics.findByIdAndUpdate(logistics._id, {
            orderId: matchingOrder._id
          });
          fixedCount++;
        }
      }
    }
    
    res.json({
      success: true,
      message: `Fixed ${fixedCount} logistics entries`,
      totalLogistics: allLogistics.length
    });
  } catch (error) {
    console.error("Error repairing data:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
logisticsRouter.get("/check-logistics-data", authUser, async (req, res) => {
  try {
    // Get all logistics entries
    const allLogistics = await Logistics.find().lean();
    
    // Format them for easy viewing
    const logisticsData = allLogistics.map(log => ({
      _id: log._id,
      orderId: log.orderId ? log.orderId.toString() : "MISSING",
      userId: log.userId ? log.userId.toString() : "MISSING",
      status: log.status || "MISSING",
      items: (log.items || []).length,
      hasItems: Array.isArray(log.items) && log.items.length > 0
    }));
    
    res.json({
      success: true,
      totalLogistics: allLogistics.length,
      logisticsData
    });
  } catch (error) {
    console.error("Error checking logistics data:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

logisticsRouter.get("/direct-fix/:logisticsId/:orderId", authUser, async (req, res) => {
  try {
    const { logisticsId, orderId } = req.params;
    
    // Validate the IDs
    if (!mongoose.Types.ObjectId.isValid(logisticsId) || 
        !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid logistics or order ID" 
      });
    }
    
    // Update the logistics entry
    const result = await Logistics.findByIdAndUpdate(
      logisticsId,
      { orderId: new mongoose.Types.ObjectId(orderId) },
      { new: true }
    );
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Logistics entry not found"
      });
    }
    
    res.json({
      success: true,
      message: "Logistics entry updated successfully",
      updatedEntry: {
        _id: result._id,
        orderId: result.orderId,
        status: result.status
      }
    });
  } catch (error) {
    console.error("Error fixing logistics:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
// Make sure you still have your export at the end of the file
export default logisticsRouter;
