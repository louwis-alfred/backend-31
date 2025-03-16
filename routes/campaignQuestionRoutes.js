import express from "express";
import { softAuth, authUser } from "../middleware/authRoles.js";
import {
  getCampaignQuestions,
  addCampaignQuestion,
  addReply,
  deleteQuestion,
} from "../controllers/campaignQuestionController.js";

const router = express.Router();

router.get("/public/questions/:campaignId", getCampaignQuestions);

// Authentication optional route (will use user info if authenticated)
router.get("/questions/:campaignId", softAuth, getCampaignQuestions);

// Protected routes that require authentication
router.post("/questions/add", authUser, addCampaignQuestion);
router.post("/questions/reply", authUser, addReply);
router.delete("/questions/:questionId", authUser, deleteQuestion);
export default router;