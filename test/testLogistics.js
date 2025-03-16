import mongoose from "mongoose";
import dotenv from "dotenv";
import Logistics from "../models/logisticsModel.js";
import Order from "../models/orderModel.js";
import CourierPanel from "../models/courierPanelModel.js";

// Load environment variables
dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const run = async () => {
  const connection = await connectDB();

  try {
    // List all orders
    console.log("--- All Orders ---");
    const orders = await Order.find().limit(5).lean();
    console.log(`Found ${await Order.countDocuments()} orders`);
    orders.forEach((order) => {
      console.log(`Order ID: ${order._id}`);
    });

    // List all logistics entries
    console.log("\n--- All Logistics Entries ---");
    const logistics = await Logistics.find().limit(5).lean();
    console.log(`Found ${await Logistics.countDocuments()} logistics entries`);
    logistics.forEach((entry) => {
      console.log(
        `Logistics ID: ${entry._id}, Order ID: ${entry.orderId || "Missing"}`
      );
    });

    // List all courier panel entries
    console.log("\n--- All Courier Panel Entries ---");
    const courierPanel = await CourierPanel.find().limit(5).lean();
    console.log(
      `Found ${await CourierPanel.countDocuments()} courier panel entries`
    );
    courierPanel.forEach((entry) => {
      console.log(
        `CourierPanel ID: ${entry._id}, Order ID: ${entry.orderId || "Missing"}`
      );
    });

    // Test the first order ID
    if (orders.length > 0) {
      const testOrderId = orders[0]._id;
      console.log(`\n--- Testing With Order ID: ${testOrderId} ---`);

      // Check logistics
      const logisticsForOrder = await Logistics.findOne({
        orderId: testOrderId,
      }).lean();
      console.log(`Found in Logistics: ${logisticsForOrder ? "Yes" : "No"}`);

      // Check courierPanel
      const courierPanelForOrder = await CourierPanel.findOne({
        orderId: testOrderId,
      }).lean();
      console.log(
        `Found in CourierPanel: ${courierPanelForOrder ? "Yes" : "No"}`
      );

      // Show what would be returned by unified endpoint
      console.log("\n--- Simulated Unified Response ---");
      if (courierPanelForOrder) {
        console.log(
          `Status: ${courierPanelForOrder.status || "Assigned to Courier"}`
        );
        console.log("Source: courierPanel");
      } else if (logisticsForOrder) {
        console.log(`Status: ${logisticsForOrder.status || "Shipped"}`);
        console.log("Source: logistics");
      } else {
        console.log("Status: Processing");
        console.log("Source: default");
      }
    }
  } catch (error) {
    console.error("Error during test:", error);
  } finally {
    // Close the connection
    await connection.connection.close();
    console.log("Connection closed");
  }
};

run();
