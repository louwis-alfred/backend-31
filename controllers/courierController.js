import Courier from '../models/courierModel.js';
import Shipment from '../models/shipmentModel.js';
import Order from '../models/orderModel.js';
import NotificationService from '../services/notificationService.js';
import mongoose from 'mongoose';

// Admin: Get all couriers
export const getAllCouriers = async (req, res) => {
  try {
    const couriers = await Courier.find({}).sort({ name: 1 });
    
    res.json({
      success: true,
      count: couriers.length,
      couriers
    });
  } catch (error) {
    console.error('Error fetching couriers:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin: Create new courier
export const createCourier = async (req, res) => {
  try {
    const { name, contactEmail, contactPhone, serviceAreas, shippingRates } = req.body;
    
    const newCourier = new Courier({
      name,
      contactEmail,
      contactPhone,
      serviceAreas: serviceAreas || [],
      shippingRates: shippingRates || []
    });
    
    await newCourier.save();
    
    res.status(201).json({
      success: true,
      message: 'Courier created successfully',
      courier: newCourier
    });
  } catch (error) {
    console.error('Error creating courier:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin: Update courier
export const updateCourier = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const courier = await Courier.findById(id);
    
    if (!courier) {
      return res.status(404).json({
        success: false,
        message: 'Courier not found'
      });
    }
    
    Object.keys(updates).forEach(key => {
      courier[key] = updates[key];
    });
    
    await courier.save();
    
    res.json({
      success: true,
      message: 'Courier updated successfully',
      courier
    });
  } catch (error) {
    console.error('Error updating courier:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin: Delete courier
export const deleteCourier = async (req, res) => {
  try {
    const { id } = req.params;
    
    const courier = await Courier.findById(id);
    
    if (!courier) {
      return res.status(404).json({
        success: false,
        message: 'Courier not found'
      });
    }
    
    // Check if courier is assigned to any shipments
    const hasShipments = await Shipment.exists({ courierId: id });
    
    if (hasShipments) {
      // Instead of deleting, mark as inactive
      courier.isActive = false;
      await courier.save();
      
      return res.json({
        success: true,
        message: 'Courier marked as inactive because it has existing shipments'
      });
    }
    
    await courier.deleteOne();
    
    res.json({
      success: true,
      message: 'Courier deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting courier:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin: Assign courier to order
export const assignCourierToOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { courierId, shippingMethod, estimatedDelivery, instructions, needsRefrigeration, insuranceAmount, isContactless } = req.body;
    
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Find order and courier
      const order = await Order.findById(orderId).session(session);
      const courier = await Courier.findById(courierId).session(session);
      
      if (!order) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }
      
      if (!courier) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'Courier not found'
        });
      }
      
      // Update order shipping information
      if (!order.shipping) {
        order.shipping = {};
      }
      
      order.shipping.courier = courierId;
      order.shipping.method = shippingMethod || 'Standard';
      order.shipping.estimatedDelivery = estimatedDelivery ? new Date(estimatedDelivery) : undefined;
      order.shipping.instructions = instructions;
      order.shipping.needsRefrigeration = needsRefrigeration || false;
      order.shipping.insuranceAmount = insuranceAmount || 0;
      order.shipping.isContactless = isContactless || false;
      
      // If the order is confirmed and now we're assigning shipping, update status to Processing
      if (order.status === 'Confirmed') {
        order.status = 'Processing';
        
        // Add tracking history
        if (!order.tracking) {
          order.tracking = { history: [] };
        }
        
        order.tracking.history.push({
          status: 'Processing',
          timestamp: new Date(),
          note: `Order assigned to courier: ${courier.name}`,
          updatedBy: req.user._id
        });
      }
      
      await order.save({ session });
      
      // Create notification for buyer
      await NotificationService.create({
        recipient: order.userId,
        type: 'SHIPPING_ASSIGNED',
        title: 'Shipping Arranged',
        message: `Your order #${order._id} has been assigned to ${courier.name} for delivery.`,
        data: {
          orderId: order._id,
          courierId: courier._id,
          courierName: courier.name,
          estimatedDelivery: estimatedDelivery
        }
      });
      
      await session.commitTransaction();
      
      res.json({
        success: true,
        message: 'Courier assigned to order successfully',
        order: {
          _id: order._id,
          status: order.status,
          shipping: order.shipping
        }
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Error assigning courier to order:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
export const trackShipmentByNumber = async (req, res) => {
    try {
      const { trackingNumber } = req.params;
      
      // Find the shipment with this tracking number
      const shipment = await Shipment.findOne({ trackingNumber })
        .populate('courierId', 'name contactPhone trackingUrlTemplate')
        .populate({
          path: 'orderId',
          select: 'userId status shipping items',
          populate: {
            path: 'items.product',
            select: 'name images'
          }
        });
      
      if (!shipment) {
        return res.status(404).json({
          success: false,
          message: 'No shipment found with this tracking number'
        });
      }
      
      // Check if the user is authorized to view this tracking info
      // Either they're the order owner or an admin
      if (req.user && req.user.role !== 'admin' && 
          shipment.orderId && shipment.orderId.userId &&
          req.user._id.toString() !== shipment.orderId.userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view this shipment'
        });
      }
      
      // Format tracking history with most recent updates first
      const trackingHistory = [...shipment.locationHistory].sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
      
      // Determine current status
      const currentStatus = trackingHistory.length > 0 
        ? trackingHistory[0].status 
        : shipment.status || 'Processing';
      
      // Construct tracking information response
      const trackingInfo = {
        success: true,
        tracking: {
          trackingNumber: shipment.trackingNumber,
          status: currentStatus,
          estimatedDelivery: shipment.estimatedDelivery,
          courier: {
            name: shipment.courierId?.name || 'Shipping Partner',
            contact: shipment.courierId?.contactPhone,
            trackingUrl: shipment.courierId?.trackingUrlTemplate?.replace('{trackingNumber}', shipment.trackingNumber) || null
          },
          history: trackingHistory.map(entry => ({
            status: entry.status,
            location: entry.location,
            timestamp: entry.timestamp,
            details: entry.notes
          })),
          packageInfo: {
            weight: shipment.weight,
            dimensions: shipment.dimensions,
            items: shipment.orderId?.items.length || 'Unknown'
          }
        }
      };
      
      res.json(trackingInfo);
      
    } catch (error) {
      console.error('Error tracking shipment by number:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve tracking information'
      });
    }
  };
export const trackShipment = async (req, res) => {
    try {
      const { trackingNumber } = req.params;
      
      const shipment = await Shipment.findOne({ trackingNumber })
        .populate('courierId', 'name contactPhone')
        .populate('orderId', 'userId status');
      
      if (!shipment) {
        return res.status(404).json({
          success: false,
          message: 'No shipment found with this tracking number'
        });
      }
      
      // Verify the shipment belongs to the user
      if (req.user._id.toString() !== shipment.orderId.userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view this shipment'
        });
      }
      
      res.json({
        success: true,
        shipment: {
          trackingNumber: shipment.trackingNumber,
          status: shipment.status,
          courier: shipment.courierId.name,
          courierContact: shipment.courierId.contactPhone,
          estimatedDelivery: shipment.estimatedDelivery,
          currentLocation: shipment.locationHistory.length > 0 
            ? shipment.locationHistory[shipment.locationHistory.length - 1].location 
            : 'Not available',
          locationHistory: shipment.locationHistory.map(loc => ({
            status: loc.status,
            location: loc.location,
            timestamp: loc.timestamp,
            notes: loc.notes
          })),
          orderStatus: shipment.orderId.status
        }
      });
    } catch (error) {
      console.error('Error tracking shipment:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

// Admin: Get all pending shipments (orders needing courier assignment)
export const getPendingShipments = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const skip = (page - 1) * limit;
    
    // Find orders that are confirmed but don't have a courier assigned
    const orders = await Order.find({
      status: 'Confirmed',
      'shipping.courier': { $exists: false }
    })
      .populate('userId', 'name email')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ date: 1 }); // Oldest first
    
    const total = await Order.countDocuments({
      status: 'Confirmed',
      'shipping.courier': { $exists: false }
    });
    
    const processedOrders = orders.map(order => ({
      _id: order._id,
      orderNumber: order.orderNumber || order._id,
      customerName: order.userId?.name || 'Unknown',
      customerEmail: order.userId?.email || 'Unknown',
      date: order.date,
      itemCount: order.items?.length || 0,
      amount: order.amount,
      address: order.address ? 
        `${order.address.street}, ${order.address.city}, ${order.address.state} ${order.address.zipcode}, ${order.address.country}`
        : 'No address provided'
    }));
    
    res.json({
      success: true,
      count: orders.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      orders: processedOrders
    });
  } catch (error) {
    console.error('Error getting pending shipments:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get shipping rates for a specific region pair
export const getShippingRates = async (req, res) => {
  try {
    const { fromRegion, toRegion } = req.query;
    
    if (!fromRegion || !toRegion) {
      return res.status(400).json({
        success: false,
        message: 'Both fromRegion and toRegion are required'
      });
    }
    
    const couriers = await Courier.find({ 
      isActive: true,
      shippingRates: {
        $elemMatch: {
          fromRegion: fromRegion,
          toRegion: toRegion
        }
      }
    });
    
    const rates = couriers.map(courier => {
      const matchingRate = courier.shippingRates.find(
        rate => rate.fromRegion === fromRegion && rate.toRegion === toRegion
      );
      
      return {
        courierId: courier._id,
        courierName: courier.name,
        basePrice: matchingRate.basePrice,
        pricePerKg: matchingRate.pricePerKg,
        estimatedDays: matchingRate.estimatedDays
      };
    });
    
    res.json({
      success: true,
      count: rates.length,
      rates
    });
  } catch (error) {
    console.error('Error getting shipping rates:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};