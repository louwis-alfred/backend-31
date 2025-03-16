// Add this to a temporary script file and run it once
import mongoose from 'mongoose';
import Logistics from './models/logisticsModel.js';
import Order from './models/orderModel.js';

const fixLogisticsEntries = async () => {
  try {
    console.log("Fixing logistics entries...");
    
    // Get all logistics entries
    const logisticsEntries = await Logistics.find({});
    console.log(`Found ${logisticsEntries.length} logistics entries to check`);
    
    // For each entry, try to find a matching order
    for (const entry of logisticsEntries) {
      // Look for orders with matching user and similar date
      const potentialOrders = await Order.find({
        userId: entry.userId,
        // If you have a date field to match approximately
        date: { 
          $gte: new Date(entry.date - 86400000), // 1 day before
          $lte: new Date(entry.date + 86400000)  // 1 day after
        }
      });
      
      if (potentialOrders.length === 1) {
        // If exactly one match, update the logistics entry
        entry.orderId = potentialOrders[0]._id;
        await entry.save();
        console.log(`Updated logistics entry ${entry._id} with order ID ${potentialOrders[0]._id}`);
      } else if (potentialOrders.length > 1) {
        console.log(`Multiple potential orders found for logistics entry ${entry._id}, manual review required`);
      } else {
        console.log(`No matching order found for logistics entry ${entry._id}`);
      }
    }
    
    console.log("Finished fixing logistics entries");
  } catch (error) {
    console.error("Error fixing logistics entries:", error);
  }
};

fixLogisticsEntries();