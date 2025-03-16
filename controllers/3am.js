import Logistics from "../models/logisticsModel.js";
import Courier from "../models/courierModel.js";
import mongoose from "mongoose";

export const getLogisticsStatusAndCourierName = async (req, res) => {
    try {
      const { orderId } = req.params;
      
      // Convert to ObjectId to ensure proper comparison
      const orderObjectId = new mongoose.Types.ObjectId(orderId);
      
      // Fetch the logistics entry where orderId field equals the provided orderId
      const logisticsEntry = await Logistics.findOne({ 
        orderId: orderObjectId 
      }).populate('courierId');
  
      if (!logisticsEntry) {
        return res.status(404).json({ 
          success: false,
          message: 'Logistics entry not found for this order' 
        });
      }
  
      // Extract the status and courier name
      const status = logisticsEntry.status || "Processing";
      const courierName = logisticsEntry.courierId ? logisticsEntry.courierId.name : 'Not Assigned';
  
      res.json({ 
        success: true,
        status, 
        courierName,
        source: 'logistics'
      });
    } catch (error) {
      console.error('Error fetching logistics status and courier name:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error fetching logistics status and courier name',
        error: error.message
      });
    }
};