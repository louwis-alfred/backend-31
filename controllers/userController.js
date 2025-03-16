import userModel from "../models/userModel.js";
import validator from "validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cloudinary from "../config/cloudinaryConfig.js";
import campaignModel from "../models/campaignModel.js";
import investmentModel from "../models/investmentModel.js";
import fs from "fs"; // Import fs at the top level

// createToken generates a JWT token using the user's id and a secret key from environment variables.
const createToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET);
};

// loginUser handles user authentication by verifying email and password, returning a JWT token on success.
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User doesn't exist" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      const token = createToken(user._id);
      res.json({ success: true, token });
    } else {
      res.json({ success: false, message: "Invalid credentials" });
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// getCurrentUser retrieves the authenticated user's data (excluding password) using their ID from the request.
export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await userModel.findById(userId).select("-password");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error("Error fetching current user:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// registerUser creates a new user account with email validation and password hashing, returning a JWT token.
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const exists = await userModel.findOne({ email });
    if (exists) {
      return res.json({ success: false, message: "User already exists" });
    }
    if (!validator.isEmail(email)) {
      return res.json({
        success: false,
        message: "Please enter a valid email",
      });
    }
    if (password.length < 8) {
      return res.json({
        success: false,
        message: "Please enter a strong password",
      });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = new userModel({
      name,
      email,
      password: hashedPassword,
    });
    const user = await newUser.save();
    const token = createToken(user._id);
    res.json({ success: true, token });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// adminLogin authenticates an admin user using predefined credentials from environment variables.
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (
      email === process.env.ADMIN_EMAIL &&
      password === process.env.ADMIN_PASSWORD
    ) {
      const token = jwt.sign(email + password, process.env.JWT_SECRET);
      res.json({ success: true, token });
    } else {
      res.json({ success: false, message: "Invalid credentials" });
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// applySeller allows a user to apply as a seller, uploading a document to Cloudinary and updating their role.
export const applySeller = async (req, res) => {
  try {
    console.log("Starting seller application process");
    
    // Validate request
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Supporting document is required",
      });
    }

    const user = await userModel.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Upload document to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path);
    
    // Check if already has seller role to prevent duplicates
    if (!user.role.includes("seller")) {
      user.role.push("seller");
    }
    
    // Update user with seller application details
    user.sellerApplication = {
      businessName: req.body.businessName,
      companyType: req.body.companyType,
      province: req.body.province,
      city: req.body.city,
      farmLocation: req.body.farmLocation,
      contactNumber: req.body.contactNumber,
      email: req.body.email || user.email,
      supportingDocument: result.secure_url,
      status: "approved", // Auto-approve instead of pending
    };
    
    await user.save();
    
    // Clean up the temporary file - using imported fs
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.json({ 
      success: true, 
      message: "Successfully applied as Seller! You can now access seller features."
    });
  } catch (error) {
    console.error("Error applying as seller:", error);
    // Clean up temporary file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// applyInvestor allows a user to apply as an investor, uploading a document and updating their role.
export const applyInvestor = async (req, res) => {
  try {
    console.log("Starting investor application process");
    
    // Validate request
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Supporting document is required",
      });
    }

    const user = await userModel.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Upload document to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path);
    
    // Check if already has investor role to prevent duplicates
    if (!user.role.includes("investor")) {
      user.role.push("investor");
    }
    
    // Update user with investment application details
    user.investorApplication = {
      investmentType: req.body.investmentType,
      companyName: req.body.companyName || "",
      industry: req.body.industry || "",
      contactNumber: req.body.contactNumber,
      supportingDocument: result.secure_url,
      investmentAmount: parseFloat(req.body.investmentAmount),
      status: "approved", // Auto-approve instead of pending
    };
    
    await user.save();
    
    // Clean up the temporary file - using imported fs
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.json({ 
      success: true, 
      message: "Successfully applied as Investor! You can now access investor features."
    });
  } catch (error) {
    console.error("Error applying as investor:", error);
    // Clean up temporary file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// checkSellerStatus checks if the authenticated user has a seller role.
export const checkSellerStatus = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(200).json({
        success: true,
        isSeller: false,
      });
    }
    const user = await userModel.findById(req.user.id || req.user._id);
    if (!user) {
      return res.status(200).json({
        success: true,
        isSeller: false,
      });
    }
    const isSeller = user.role && user.role.includes("seller");
    res.status(200).json({ success: true, isSeller });
  } catch (error) {
    console.log("Error:", error);
    res.status(200).json({
      success: true,
      isSeller: false,
      error: "Failed to check seller status",
    });
  }
};

// getInvestorProfile retrieves an investor's profile and recent investment history.
export const getInvestorProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const investor = await userModel
      .findById(userId)
      .select("name email investorApplication totalInvested investmentStats")
      .lean();
    if (!investor) {
      return res.status(404).json({
        success: false,
        message: "Investor not found",
      });
    }
    const investments = await investmentModel
      .find({ userId })
      .select("amount status campaignId date")
      .populate("campaignId", "title")
      .sort("-date")
      .limit(5);
    res.json({
      success: true,
      investor: {
        ...investor,
        recentInvestments: investments,
      },
    });
  } catch (error) {
    console.error("Error fetching investor profile:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve investor profile",
    });
  }
};

// getInvestorDocuments retrieves an investor's supporting documents, restricted to admins or the investor.
export const getInvestorDocuments = async (req, res) => {
  try {
    const { investorId } = req.params;
    if (!req.user.role.includes('admin') && 
        req.user._id.toString() !== investorId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view these documents"
      });
    }
    const investor = await userModel.findById(investorId)
      .select('name email investorApplication.supportingDocument')
      .lean();
    if (!investor || !investor.investorApplication) {
      return res.status(404).json({
        success: false,
        message: "Investor or documents not found"
      });
    }
    res.status(200).json({
      success: true,
      documents: {
        supportingDocument: investor.investorApplication.supportingDocument,
        investorName: investor.name,
        investorEmail: investor.email
      }
    });
  } catch (error) {
    console.error("Error fetching investor documents:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve investor documents",
      error: error.message
    });
  }
};

// getSellers fetches all users with the seller role from the database.
export const getSellers = async (req, res) => {
  try {
    console.log("Fetching sellers...");
    const sellers = await userModel.find({ role: "seller" });
    console.log("Sellers fetched:", sellers);
    res.json({ success: true, sellers });
  } catch (error) {
    console.error("Error fetching sellers:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

export const checkInvestorStatus = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(200).json({
        success: true,
        isInvestor: false,
      });
    }
    
    const user = await userModel.findById(req.user.id || req.user._id);
    if (!user) {
      return res.status(200).json({
        success: true,
        isInvestor: false,
      });
    }
    
    const isInvestor = user.role && user.role.includes("investor");
    
    // No need to check application status since we auto-approve now
    res.status(200).json({
      success: true,
      isInvestor
    });
  } catch (error) {
    console.log("Error:", error);
    res.status(200).json({
      success: true,
      isInvestor: false,
      error: "Failed to check investor status",
    });
  }
};

// getInvestors fetches all users with the investor role from the database.
export const getInvestors = async (req, res) => {
  try {
    console.log("Fetching investors...");
    const investors = await userModel.find({ role: "investor" });
    console.log("Investors fetched:", investors.length);
    res.json({ success: true, investors });
  } catch (error) {
    console.error("Error fetching investors:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// getInvestorDashboardData retrieves an investor's complete profile and associated campaigns.
export const getInvestorDashboardData = async (req, res) => {
  try {
    console.log("Fetching investor profile for user ID:", req.user._id);
    const investorId = req.user._id;
    const investor = await userModel.findById(investorId);
    const campaigns = await campaignModel.find({ investorId });
    res.json({
      success: true,
      user: investor,
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export { loginUser, registerUser, adminLogin };