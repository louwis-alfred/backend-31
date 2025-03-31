import express from "express";
import {
  registerUser,
  loginUser,
  applySeller,
  applyInvestor,
  // checkSellerStatus,
  getSellers,
  // checkInvestorStatus,
  getCurrentUser,
  getSellerDocuments, // Add these new functions
  getInvestorDocuments,
  getSellerProfile,
  getInvestorProfile,
  getInvestors,
  getUserRole
} from "../controllers/userController.js";
import {
  authUser,
  authSeller,
  authInvestor,
  authBuyer,
} from "../middleware/authRoles.js";
import upload from "../config/multerConfig.js";
import fs from "fs";
import cloudinary from "../config/cloudinaryConfig.js";

const userRouter = express.Router();

// Regular routes
userRouter.post("/register", upload.single("supportingDocument"), registerUser);
userRouter.post("/login", loginUser);
userRouter.get('/role', authUser, getUserRole)
// Apply as seller/investor routes (with file upload support)
userRouter.post(
  "/apply-seller",
  authUser,
  upload.single("supportingDocument"),
  applySeller
);
userRouter.post(
  "/apply-investor",
  authUser,
  upload.single("supportingDocument"),
  applyInvestor
);

// Document upload-only endpoint for pre-uploading documents
userRouter.post(
  "/upload-document",
  authUser,
  upload.single("document"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Document file is required",
        });
      }

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path);

      // Delete the temporary file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      // Return the URL to be used in role application
      res.json({
        success: true,
        documentUrl: result.secure_url,
      });
    } catch (error) {
      console.error("Error uploading document:", error);

      // Clean up temporary file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        success: false,
        message: "Error uploading document",
        error: error.message,
      });
    }
  }
);

// Status check endpoints
// userRouter.get("/seller-status", authUser, checkSellerStatus);
// userRouter.get("/check-investor-status", authUser, checkInvestorStatus);

// Profile and document routes
userRouter.get("/me", authUser, getCurrentUser);
userRouter.get("/sellers", authUser, getSellers);
userRouter.get("/investors", authUser, getInvestors);

userRouter.get("/seller/:sellerId/documents", authUser, getSellerDocuments);
userRouter.get(
  "/investor/:investorId/documents",
  authUser,
  getInvestorDocuments
);
userRouter.get("/seller/:sellerId/profile", authUser, getSellerProfile);
userRouter.get("/investor/:userId/profile", authUser, getInvestorProfile);

// Role-specific test routes
userRouter.get("/seller", authUser, authSeller, (req, res) => {
  res.status(200).json({ success: true, message: "Seller access granted." });
});
userRouter.get("/investor", authUser, authInvestor, (req, res) => {
  res.status(200).json({ success: true, message: "Investor access granted." });
});
userRouter.get("/buyer", authUser, authBuyer, (req, res) => {
  res.status(200).json({ success: true, message: "Buyer access granted." });
});

export default userRouter;
