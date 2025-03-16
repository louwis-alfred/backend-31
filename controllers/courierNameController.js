import Order from "../models/orderModel.js";
import CourierPanel from "../models/courierPanelModel.js";
import Logistics from "../models/logisticsModel.js";
import Courier from "../models/courierModel.js";
import mongoose from "mongoose";

// Simple endpoint that only returns the courier name for an order
export const getCourierName = async (req, res) => {
    try {
      const { orderId } = req.params;
      
      // Basic validation
      if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({
          success: false,
          message: "Valid order ID required"
        });
      }
      
      const orderObjectId = new mongoose.Types.ObjectId(orderId);
      let courierName = "Not Assigned";
      let source = "default";
      
      console.log(`[COURIER-NAME] Fetching courier name for order: ${orderId}`);
      
      // STRATEGY 1: Check Order collection directly without populate
      const order = await Order.findById(orderObjectId).lean();
      
      if (order && order.courierId) {
        try {
          // Get courier details separately instead of using populate
          const courier = await Courier.findById(order.courierId).lean();
          if (courier && courier.name) {
            courierName = courier.name;
            source = "order";
            
            console.log(`[COURIER-NAME] Found in Order: ${courierName}`);
            return res.json({
              success: true,
              orderId: orderId,
              courierName,
              source
            });
          }
        } catch (courierErr) {
          console.error(`[COURIER-NAME] Error fetching courier: ${courierErr.message}`);
        }
      }
      
      // STRATEGY 2: Check CourierPanel collection
      try {
        const courierPanel = await CourierPanel.findOne({ orderId: orderObjectId }).lean();
        
        if (courierPanel && courierPanel.courierId) {
          // Get courier details separately
          const courier = await Courier.findById(courierPanel.courierId).lean();
          if (courier && courier.name) {
            courierName = courier.name;
            source = "courierPanel";
            
            console.log(`[COURIER-NAME] Found in CourierPanel: ${courierName}`);
            return res.json({
              success: true,
              orderId: orderId,
              courierName,
              source
            });
          }
        }
      } catch (panelErr) {
        console.error(`[COURIER-NAME] Error with CourierPanel: ${panelErr.message}`);
      }
      
      // STRATEGY 3: Check Logistics collection
      try {
        const logistics = await Logistics.findOne({ orderId: orderObjectId }).lean();
        
        if (logistics && logistics.courierId) {
          // Get courier details separately
          const courier = await Courier.findById(logistics.courierId).lean();
          if (courier && courier.name) {
            courierName = courier.name;
            source = "logistics";
            
            console.log(`[COURIER-NAME] Found in Logistics: ${courierName}`);
            return res.json({
              success: true,
              orderId: orderId,
              courierName,
              source
            });
          }
        }
      } catch (logisticsErr) {
        console.error(`[COURIER-NAME] Error with Logistics: ${logisticsErr.message}`);
      }
      
      // Default response when no courier found
      console.log(`[COURIER-NAME] No courier found for order: ${orderId}`);
      return res.json({
        success: true,
        orderId: orderId,
        courierName,
        source
      });
      
    } catch (error) {
      console.error(`[COURIER-NAME] Error: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: "Error retrieving courier name",
        error: error.message
      });
    }
  };