import CourierPanel from '../models/courierPanelModel.js';
import Logistics from '../models/logisticsModel.js';
import Order from '../models/orderModel.js';
import Courier from '../models/courierModel.js';
import mongoose from 'mongoose';



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
    
    // STRATEGY 1: Check Order collection without populate
    const order = await Order.findById(orderObjectId).lean();
    
    if (order && order.courierId) {
      // Get courier details separately to avoid populate issues
      try {
        const courier = await Courier.findById(order.courierId).lean();
        if (courier) {
          courierName = courier.name || "Unnamed Courier";
          source = "order";
          
          console.log(`[COURIER-NAME] Found in Order: ${courierName}`);
          return res.json({
            success: true,
            orderId: orderId,
            courierName,
            source
          });
        }
      } catch (err) {
        console.log(`[COURIER-NAME] Error finding courier from Order: ${err.message}`);
      }
    }
    
    // STRATEGY 2: Check CourierPanel collection without populate
    const courierPanel = await CourierPanel.findOne({ orderId: orderObjectId }).lean();
    
    if (courierPanel && courierPanel.courierId) {
      try {
        const courier = await Courier.findById(courierPanel.courierId).lean();
        if (courier) {
          courierName = courier.name || "Unnamed Courier";
          source = "courierPanel";
          
          console.log(`[COURIER-NAME] Found in CourierPanel: ${courierName}`);
          return res.json({
            success: true,
            orderId: orderId,
            courierName,
            source
          });
        }
      } catch (err) {
        console.log(`[COURIER-NAME] Error finding courier from CourierPanel: ${err.message}`);
      }
    }
    
    // STRATEGY 3: Check Logistics collection without populate
    const logistics = await Logistics.findOne({ orderId: orderObjectId }).lean();
    
    if (logistics && logistics.courierId) {
      try {
        const courier = await Courier.findById(logistics.courierId).lean();
        if (courier) {
          courierName = courier.name || "Unnamed Courier";
          source = "logistics";
          
          console.log(`[COURIER-NAME] Found in Logistics: ${courierName}`);
          return res.json({
            success: true,
            orderId: orderId,
            courierName,
            source
          });
        }
      } catch (err) {
        console.log(`[COURIER-NAME] Error finding courier from Logistics: ${err.message}`);
      }
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

// Fetch status by orderId
export const getStatusByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find the courier panel document by orderId
    const courierPanel = await CourierPanel.findOne({ orderId });

    if (!courierPanel) {
      return res.status(404).json({ message: 'Courier panel not found' });
    }

    // Return the status
    res.status(200).json({ status: courierPanel.status });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Fetch status by courierId
export const getStatusByCourierId = async (req, res) => {
  try {
    const { courierId } = req.params;

    // Find the courier panel document by courierId
    const courierPanel = await CourierPanel.findOne({ courierId });

    if (!courierPanel) {
      return res.status(404).json({ message: 'Courier panel not found' });
    }

    // Return the status
    res.status(200).json({ status: courierPanel.status });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get unified courier status info from multiple sources
export const getUnifiedCourierStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }
    
    const orderObjectId = new mongoose.Types.ObjectId(orderId);
    
    // First check CourierPanel (higher priority)
    const courierPanel = await CourierPanel.findOne({ orderId: orderObjectId })
      .populate('courierId', 'name plate_number address')
      .lean();
      
    // Then check Logistics
    const logistics = await Logistics.findOne({ orderId: orderObjectId })
      .populate('courierId', 'name plate_number address')
      .lean();
      
    // Get the order for basic info
    const order = await Order.findById(orderObjectId).lean();
    
    // Determine which source to use and extract info
    let courierInfo = {
      orderId: orderId,
      courierName: 'Not Assigned',
      status: order?.status || 'Processing',
      source: 'default',
      trackingDetails: null
    };
    
    if (courierPanel) {
      courierInfo = {
        orderId: orderId,
        courierName: courierPanel.courierId?.name || 'Assigned to Courier',
        status: courierPanel.status || 'Assigned to Courier',
        source: 'courierPanel',
        trackingDetails: {
          courierInfo: courierPanel.courierId ? {
            name: courierPanel.courierId.name || 'Unnamed Courier',
            plate: courierPanel.courierId.plate_number || '',
            address: courierPanel.courierId.address || ''
          } : null,
          assignedAt: courierPanel.createdAt || courierPanel.date
        }
      };
    } else if (logistics) {
      courierInfo = {
        orderId: orderId,
        courierName: logistics.courierId?.name || 'Not Assigned',
        status: logistics.status || 'Processing',
        source: 'logistics',
        trackingDetails: {
          trackingNumber: logistics.trackingNumber,
          estimatedDelivery: logistics.estimatedDelivery,
          shippedAt: logistics.shippedAt,
          deliveredAt: logistics.deliveredAt,
          courierInfo: logistics.courierId ? {
            name: logistics.courierId.name || 'Unnamed Courier',
            plate: logistics.courierId.plate_number || '',
            address: logistics.courierId.address || ''
          } : null
        }
      };
    }
    
    res.json({
      success: true,
      ...courierInfo
    });
    
  } catch (error) {
    console.error('Error fetching unified courier status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching courier status',
      error: error.message
    });
  }
};