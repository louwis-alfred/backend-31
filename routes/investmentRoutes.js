import express from "express";
import {
  placeInvestment,
  allInvestments,
  userInvestments,
  updateInvestmentStatus,
  getInvestmentsByCampaign,
  confirmInvestment,
  acceptInvestment,
  rejectInvestment,
  getCompletedInvestmentsByCampaign,
  getRejectedInvestmentsByCampaign,
  getRecentInvestmentsByCampaign,
  getInvestmentHistory
} from "../controllers/investmentController.js";
import { authUser, authInvestor, authSeller } from "../middleware/authRoles.js";

const router = express.Router();

// Place a new investment
router.post("/create", authUser, authInvestor, placeInvestment);

// Get all investments
router.get("/all", authUser, allInvestments);

// Get user investments
router.get("/user", authUser, userInvestments);

// Get investments by campaign ID
router.get("/campaign/:campaignId", authUser, getInvestmentsByCampaign);

// Update investment status (now seller only)
router.put("/update-status", authUser, authSeller, updateInvestmentStatus);

// Confirm an investment (now no authentication required for testing)
// Confirm investment routes (with seller authentication)
router.post("/confirm", authUser, authSeller, confirmInvestment);
router.post("/confirm/:investmentId", authUser, authSeller, confirmInvestment);
// Accept investment (seller only)
router.post("/accept", authUser, authSeller, acceptInvestment);
router.post("/accept/:investmentId", authUser, authSeller, acceptInvestment);
// Reject investment (seller only)
router.post("/reject", authUser, authSeller, rejectInvestment);
router.post("/reject/:investmentId", authUser, authSeller, rejectInvestment);

// Get rejected investments by campaign ID
router.get("/rejected/:campaignId", authUser, getRejectedInvestmentsByCampaign);

// Get investment history with filtering
router.get("/history", authUser, getInvestmentHistory);
// Get completed investments by campaign ID
router.get("/completed/:campaignId", authUser, getCompletedInvestmentsByCampaign);
router.get("/campaign/:campaignId/recent", getRecentInvestmentsByCampaign);
export default router;