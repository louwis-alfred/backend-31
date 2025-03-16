import express from "express";
import {
  getInvestorDashboardData,
  applyInvestor,
  getInvestors,
  getInvestorDocuments,
} from "../controllers/userController.js";
import { authUser, authInvestor } from "../middleware/authRoles.js";
import adminAuth from "../middleware/adminAuth.js";
import multer from "multer";

const investorRouter = express.Router();
const upload = multer({ dest: "uploads/" });

// Dashboard data
investorRouter.get("/dashboard", authUser, getInvestorDashboardData);
investorRouter.get("/documents/:investId", authUser, getInvestorDocuments);
// Apply as investor (already in userController but needs a route)
investorRouter.post(
  "/apply",
  authUser,
  upload.single("supportingDocument"),
  applyInvestor
);

// Admin routes
investorRouter.get("/all", adminAuth, getInvestors);

export default investorRouter;
