import productModel from "../models/productModel.js";

export const getSellerDashboardData = async (req, res) => {
  try {
    console.log("Fetching user profile for user ID:", req.user._id); // Debugging log
    const sellerId = req.user._id;
    // Fetch products posted by the seller
    const products = await productModel.find({ sellerId });
    // Optionally, record or update tracking info here
    res.json({ success: true, user: req.user, products });
  } catch (error) {
    console.error("Error fetching dashboard data:", error.message);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};