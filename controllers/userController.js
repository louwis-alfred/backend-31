import fs from "fs";
import userModel from "../models/userModel.js";
import validator from "validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cloudinary from "../config/cloudinaryConfig.js";
import campaignModel from "../models/campaignModel.js";
import investmentModel from "../models/investmentModel.js";

// createToken generates a JWT token using the user's id and a secret key from environment variables.
const createToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET);
};

export const getUserRole = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "No authenticated user found",
      });
    }

    const user = await userModel
      .findById(req.user.id || req.user._id)
      .select("role name email");
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      userRole: user.role,
      isBuyer: user.role === "buyer",
      isSeller: user.role === "seller",
      isInvestor: user.role === "investor",
      userData: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Error fetching user role:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user role",
      error: error.message
    });
  }
};


export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Email and password are required" 
      });
    }

    // Add .select('+password') to include the password field that's excluded by default
    const user = await userModel.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User doesn't exist" 
      });
    }
    
    // Check if user has a password (should always be true, but let's be safe)
    if (!user.password) {
      console.error(`User ${user._id} has no password stored`);
      return res.status(500).json({ 
        success: false, 
        message: "Authentication error" 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      const token = createToken(user._id);
      res.status(200).json({
        success: true,
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } else {
      res.status(401).json({ 
        success: false, 
        message: "Invalid credentials" 
      });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
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

export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role, ...otherFields } = req.body;
    let documentUrl = otherFields.documentUrl;

    // Handle document upload if file is provided
    if (req.file) {
      try {
        const result = await cloudinary.uploader.upload(req.file.path);
        documentUrl = result.secure_url;

        // Clean up the temporary file after successful upload
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (uploadError) {
        // Clean up the temporary file on upload error
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(500).json({
          success: false,
          message: "Error uploading document",
          error: uploadError.message,
        });
      }
    }

    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    // Check if user exists
    const exists = await userModel.findOne({ email });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user object
    const userData = {
      name,
      email,
      password: hashedPassword,
      role: role || "buyer", // Default to buyer
    };

    // Handle role-specific fields
    if (role === "seller") {
      // Validate required seller fields
      const requiredFields = [
        "businessName",
        "companyType",
        "province",
        "city",
        "farmLocation",
        "contactNumber",
      ];

      const missingFields = requiredFields.filter(
        (field) => !otherFields[field]
      );

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Missing required seller fields: ${missingFields.join(
            ", "
          )}`,
        });
      }

      // Check for required document
      if (!documentUrl) {
        return res.status(400).json({
          success: false,
          message: "Supporting document is required for seller registration",
        });
      }

      const sellerFields = {
        businessName: otherFields.businessName,
        companyType: otherFields.companyType,
        province: otherFields.province,
        city: otherFields.city,
        farmLocation: otherFields.farmLocation,
        sellerContactNumber: otherFields.contactNumber,
        sellerDocument: documentUrl, // Use the uploaded or provided document URL
      };
      Object.assign(userData, sellerFields);
    } else if (role === "investor") {
      // Validate required investor fields
      const requiredFields = ["investmentType", "contactNumber"];

      const missingFields = requiredFields.filter(
        (field) => !otherFields[field]
      );

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Missing required investor fields: ${missingFields.join(
            ", "
          )}`,
        });
      }

      // Check for required document
      if (!documentUrl) {
        return res.status(400).json({
          success: false,
          message: "Supporting document is required for investor registration",
        });
      }

      const investorFields = {
        investmentType: otherFields.investmentType,
        companyName: otherFields.companyName || "",
        industry: otherFields.industry || "",
        investorContactNumber: otherFields.contactNumber,
        investorDocument: documentUrl, // Use the uploaded or provided document URL
      };
      Object.assign(userData, investorFields);
    }

    // Create and save user
    const user = await userModel.create(userData);
    const token = createToken(user._id);

    // Return response without password
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      token,
      user: userResponse,
    });
  } catch (error) {
    // Clean up temporary file on error if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// applySeller allows a user to apply as a seller by uploading a document or providing a document URL
export const applySeller = async (req, res) => {
  try {
    console.log("Starting seller application process");
    let documentUrl;

    // Check if document is provided as file upload or URL
    if (req.file) {
      // Handle file upload approach
      try {
        const result = await cloudinary.uploader.upload(req.file.path);
        documentUrl = result.secure_url;

        // Clean up the temporary file after successful upload
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (uploadError) {
        // Clean up the temporary file on upload error
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(500).json({
          success: false,
          message: "Error uploading document",
          error: uploadError.message,
        });
      }
    } else if (req.body.documentUrl) {
      // Use the pre-uploaded document URL
      documentUrl = req.body.documentUrl;
    } else {
      return res.status(400).json({
        success: false,
        message:
          "Supporting document is required (either as file upload or URL)",
      });
    }

    // Validate required fields
    const requiredFields = [
      "businessName",
      "companyType",
      "province",
      "city",
      "farmLocation",
      "contactNumber",
    ];

    const missingFields = requiredFields.filter((field) => !req.body[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    const user = await userModel.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update user with seller details and change role
    await userModel.findByIdAndUpdate(user._id, {
      role: "seller",
      businessName: req.body.businessName,
      companyType: req.body.companyType,
      province: req.body.province,
      city: req.body.city,
      farmLocation: req.body.farmLocation,
      sellerContactNumber: req.body.contactNumber,
      sellerDocument: documentUrl,
    });

    // Get updated user and generate new token
    const updatedUser = await userModel.findById(user._id);
    const token = createToken(updatedUser._id);

    res.json({
      success: true,
      message:
        "Successfully registered as Seller! You can now access seller features.",
      token,
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    console.error("Error applying as seller:", error);
    // Clean up temporary file on error if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// applyInvestor allows a user to apply as an investor by uploading a document or providing a document URL
export const applyInvestor = async (req, res) => {
  try {
    console.log("Starting investor application process");
    let documentUrl;

    // Check if document is provided as file upload or URL
    if (req.file) {
      // Handle file upload approach
      try {
        const result = await cloudinary.uploader.upload(req.file.path);
        documentUrl = result.secure_url;

        // Clean up the temporary file after successful upload
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (uploadError) {
        // Clean up the temporary file on upload error
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(500).json({
          success: false,
          message: "Error uploading document",
          error: uploadError.message,
        });
      }
    } else if (req.body.documentUrl) {
      // Use the pre-uploaded document URL
      documentUrl = req.body.documentUrl;
    } else {
      return res.status(400).json({
        success: false,
        message:
          "Supporting document is required (either as file upload or URL)",
      });
    }

    // Validate required fields
    const requiredFields = ["investmentType", "contactNumber"];

    const missingFields = requiredFields.filter((field) => !req.body[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    const user = await userModel.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update user with investor details and change role
    await userModel.findByIdAndUpdate(user._id, {
      role: "investor",
      investmentType: req.body.investmentType,
      companyName: req.body.companyName || "",
      industry: req.body.industry || "",
      investorContactNumber: req.body.contactNumber,
      investorDocument: documentUrl,
    });

    // Get updated user and generate new token
    const updatedUser = await userModel.findById(user._id);
    const token = createToken(updatedUser._id);

    res.json({
      success: true,
      message:
        "Successfully registered as Investor! You can now access investor features.",
      token,
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    console.error("Error applying as investor:", error);
    // Clean up temporary file on error if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
// // checkSellerStatus checks if the authenticated user has a seller role.
// export const checkSellerStatus = async (req, res) => {
//   try {
//     if (!req.user) {
//       return res.status(200).json({
//         success: true,
//         isSeller: false,
//       });
//     }
//     const user = await userModel
//       .findById(req.user.id || req.user._id)
//       .select("role");
//     if (!user) {
//       return res.status(200).json({
//         success: true,
//         isSeller: false,
//       });
//     }
//     const isSeller = user.role === "seller";
//     res.status(200).json({ success: true, isSeller });
//   } catch (error) {
//     console.log("Error:", error);
//     res.status(200).json({
//       success: true,
//       isSeller: false,
//       error: "Failed to check seller status",
//     });
//   }
// };

export const getSellerProfile = async (req, res) => {
  try {
    const { sellerId } = req.params;

    // No authorization check - any authenticated user can view profile
    const seller = await userModel
      .findById(sellerId)
      .select(
        "name email businessName companyType province city farmLocation sellerContactNumber sellerDocument products"
      )
      .lean();

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    // Optionally fetch additional seller-related data
    // e.g., products, orders, etc.

    res.json({
      success: true,
      seller: seller,
    });
  } catch (error) {
    console.error("Error fetching seller profile:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve seller profile",
    });
  }
};
// getInvestorDocuments retrieves an investor's supporting documents, accessible by any registered user
export const getInvestorDocuments = async (req, res) => {
  try {
    const { investorId } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to view documents",
      });
    }

    const investor = await userModel
      .findById(investorId)
      .select("name email investorDocument")
      .lean();

    if (!investor || !investor.investorDocument) {
      return res.status(404).json({
        success: false,
        message: "Investor or documents not found",
      });
    }

    res.status(200).json({
      success: true,
      documents: {
        supportingDocument: investor.investorDocument,
        investorName: investor.name,
        investorEmail: investor.email,
      },
    });
  } catch (error) {
    console.error("Error fetching investor documents:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve investor documents",
      error: error.message,
    });
  }
};
export const getInvestorProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    // No authorization check - any authenticated user can view profile
    const investor = await userModel
      .findById(userId)
      .select(
        "name email investmentType companyName industry investorContactNumber investorDocument totalInvested investmentStats"
      )
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
// Add a similar function for seller documents
export const getSellerDocuments = async (req, res) => {
  try {
    const { sellerId } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to view documents",
      });
    }

    const seller = await userModel
      .findById(sellerId)
      .select("name email sellerDocument businessName")
      .lean();

    if (!seller || !seller.sellerDocument) {
      return res.status(404).json({
        success: false,
        message: "Seller or documents not found",
      });
    }

    res.status(200).json({
      success: true,
      documents: {
        supportingDocument: seller.sellerDocument,
        sellerName: seller.name,
        sellerEmail: seller.email,
        businessName: seller.businessName,
      },
    });
  } catch (error) {
    console.error("Error fetching seller documents:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve seller documents",
      error: error.message,
    });
  }
};
// getSellers fetches all users with the seller role from the database.
export const getSellers = async (req, res) => {
  try {
    console.log("Fetching sellers...");
    const sellers = await userModel.find({ role: "seller" });
    console.log("Sellers fetched:", sellers.length);
    res.json({ success: true, sellers });
  } catch (error) {
    console.error("Error fetching sellers:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// // Check if the authenticated user has an investor role.
// export const checkInvestorStatus = async (req, res) => {
//   try {
//     if (!req.user) {
//       return res.status(200).json({
//         success: true,
//         isInvestor: false,
//       });
//     }

//     const user = await userModel
//       .findById(req.user.id || req.user._id)
//       .select("role");
//     if (!user) {
//       return res.status(200).json({
//         success: true,
//         isInvestor: false,
//       });
//     }

//     const isInvestor = user.role === "investor";

//     res.status(200).json({
//       success: true,
//       isInvestor,
//     });
//   } catch (error) {
//     console.log("Error:", error);
//     res.status(500).json({
//       success: false,
//       isInvestor: false,
//       message: "Failed to check investor status",
//     });
//   }
// };

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

    if (!investor || investor.role !== "investor") {
      return res.status(403).json({
        success: false,
        message: "Not an investor or investor not found",
      });
    }

    const campaigns = await campaignModel.find({ investorId });

    res.json({
      success: true,
      user: investor,
      campaigns,
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
