import express from "express";
import {
  getInvestorDashboardData,
  getInvestorDocuments,
} from "../controllers/userController.js";
import { authUser, authInvestor } from "../middleware/authRoles.js";
import multer from "multer";

const investorRouter = express.Router();
const upload = multer({ dest: "uploads/" });

// Dashboard data
investorRouter.get("/dashboard", authUser, getInvestorDashboardData);
investorRouter.get("/documents/:investId", authUser, getInvestorDocuments);



export default investorRouter;
