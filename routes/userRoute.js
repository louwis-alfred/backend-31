import express from "express";
import {
  registerUser,
  loginUser,
  adminLogin,
  applySeller,
  applyInvestor,
  checkSellerStatus,
  getSellers,
  checkInvestorStatus, getCurrentUser
} from "../controllers/userController.js";
import { authUser, authSeller, authInvestor, softAuth } from "../middleware/authRoles.js";
import upload from "../config/multerConfig.js";

const userRouter = express.Router();

// Regular routes
userRouter.post("/register", registerUser);
userRouter.post("/login", loginUser);
userRouter.post("/admin", adminLogin);
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

// Use softAuth for status check endpoints
userRouter.get("/seller-status", softAuth, checkSellerStatus);
userRouter.get('/check-investor-status', softAuth, checkInvestorStatus);
userRouter.get("/me", authUser, getCurrentUser);
// Protected routes that require full authentication
userRouter.get("/sellers", authUser, getSellers);
userRouter.get("/seller", authUser, authSeller, (req, res) => {
  res.status(200).json({ success: true, message: "Seller access granted." });
});
userRouter.get("/investor", authUser, authInvestor, (req, res) => {
  res.status(200).json({ success: true, message: "Investor access granted." });
});

export default userRouter;