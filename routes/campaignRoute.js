import express from "express";
import multer from "multer";
import {
  createCampaign,
  getAllCampaigns,
  getSellerCampaigns,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  getFeaturedCampaigns,
} from "../controllers/campaignController.js";
import { authUser, authSeller } from "../middleware/authRoles.js";

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB size limit for videos
  },
});
const campaignRouter = express.Router();

// Configure upload for multiple files with field names
const uploadFields = upload.fields([
  { name: "video", maxCount: 1 }, // This must match the field name used in frontend
  { name: "thumbnail", maxCount: 1 },
]);

// Create a new campaign (sellers only)
campaignRouter.post(
  "/create",
  authUser,
  authSeller,
  uploadFields,
  createCampaign
);

// Get all campaigns
campaignRouter.get("/all", getAllCampaigns);

// Get featured campaigns
campaignRouter.get("/featured", getFeaturedCampaigns);

// Get all campaigns by seller ID
campaignRouter.get("/seller/:sellerId", getSellerCampaigns);

// Get a specific campaign
campaignRouter.get("/id/:id", authUser,getCampaignById);

// Update a campaign (sellers only)
campaignRouter.put("/:id", authUser, authSeller, updateCampaign);

// Delete a campaign (sellers only)
campaignRouter.delete("/:id", authUser, authSeller, deleteCampaign);

export default campaignRouter;
