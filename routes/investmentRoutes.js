import express from "express";
import {
  placeInvestment,
  allInvestments,
  userInvestments,
  updateInvestmentStatus,
  getInvestmentsByCampaign,
  confirmInvestment,
  acceptInvestment,
  completeInvestmentNegotiation,
  getCompletedInvestmentsByCampaign,
  getRecentInvestmentsByCampaign
} from "../controllers/investmentController.js";
import { authUser, authInvestor, authSeller } from "../middleware/authRoles.js";

const router = express.Router();

// Place a new investment
router.post("/create", authUser, placeInvestment);

// Get all investments (admin only)
router.get("/all", authUser, allInvestments);

// Get user investments
router.get("/user", authUser, userInvestments);

// Get investments by campaign ID
router.get("/campaign/:campaignId", authUser, getInvestmentsByCampaign);

// Update investment status (admin only)
router.put("/update-status", authUser, updateInvestmentStatus);

// Confirm an investment (admin only)
router.post("/confirm", authUser, confirmInvestment);

// Accept investment (seller only)
router.post("/accept", authUser, authSeller, acceptInvestment);

// Complete investment negotiation (seller only)
router.post("/complete", authUser, completeInvestmentNegotiation);

// Get completed investments by campaign ID
router.get("/completed/:campaignId", authUser, getCompletedInvestmentsByCampaign);
router.get("/campaign/:campaignId/recent", getRecentInvestmentsByCampaign);
export default router;
