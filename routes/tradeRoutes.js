import express from "express";
import {
  initiateTrade,
  acceptTrade,
  rejectTrade,
  getTrades,
  getCompletedTrades,
  removeProductFromTrade,
  updateTrade,
  getCurrentUserTradeProducts,
  getAvailableTradesForSeller,
  cancelTrade,
  addProductForTrade,
  getProductsForTrade,
  completeTrade,
  getTrade,
  uploadTradeFile,
  getProductTradeHistory,
  getReceivedTradedProducts,
} from "../controllers/tradeController.js";
import { authUser, authSeller } from "../middleware/authRoles.js";
import multer from "../config/multerConfig.js";

const router = express.Router();
router.get("/products-for-trade", authUser, getProductsForTrade);
router.get("/current-user-products", authUser, getCurrentUserTradeProducts);
router.post("/initiate", authUser, authSeller, initiateTrade);
router.post("/accept", authUser, authSeller, acceptTrade);
router.post("/reject", authUser, authSeller, rejectTrade);
router.get("/", authUser, authSeller, getTrades);
router.post("/complete", authUser, authSeller, completeTrade);
router.post("/cancel", authUser, authSeller, cancelTrade);
router.post("/add-for-trade", authUser, authSeller, addProductForTrade);
router.get(
  "/seller/:sellerId/available-trades",
  authUser,
  authSeller,
  getAvailableTradesForSeller
);
router.post("/remove-from-trade", authUser, authSeller, removeProductFromTrade);
router.post("/update", authUser, authSeller, updateTrade);
router.get("/completed", authUser, authSeller, getCompletedTrades);
router.get("/:tradeId", authUser, authSeller, getTrade);
router.get("/:productId/trade-history", authUser, getProductTradeHistory);
router.post(
  "/files/:tradeId/upload",
  authUser,
  authSeller,
  multer.single("file"),
  uploadTradeFile
);
router.get(
  "/received-products",
  authUser,
  authSeller,
  getReceivedTradedProducts
);

export default router;
