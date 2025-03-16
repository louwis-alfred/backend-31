import express from "express";
import {
  addCampaignVideo,
  removeCampaignVideo,
  setMainCampaignVideo,
} from "../controllers/campaignVideoController.js";
import { authUser, authSeller } from "../middleware/authRoles.js";
import upload from "../config/multerCampaignVideoConfig.js";

const router = express.Router();

// Upload middleware with error handling
const uploadFields = (req, res, next) => {
  const uploadMiddleware = upload.fields([
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]);

  uploadMiddleware(req, res, (err) => {
    if (err) {
      console.error("Multer upload error:", err);
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          success: false,
          message: "File too large - maximum file size is 200MB",
          error: err.message,
        });
      }
      return res.status(400).json({
        success: false,
        message: "File upload error",
        error: err.message,
      });
    }
    next();
  });
};

// Add a video to a campaign
router.post(
  "/:campaignId/videos",
  authUser,
  authSeller,
  uploadFields,
  addCampaignVideo
);

// Remove a video from a campaign
router.delete(
  "/:campaignId/videos/:videoIndex",
  authUser,
  authSeller,
  removeCampaignVideo
);

// Debug route
router.get("/test", (req, res) => {
  res.json({ message: "Campaign video routes working" });
});

// Set a video as the main campaign video
router.put(
  "/:campaignId/videos/:videoIndex/main",
  authUser,
  authSeller,
  setMainCampaignVideo
);

export default router;
