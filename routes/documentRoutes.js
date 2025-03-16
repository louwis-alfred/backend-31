import express from "express";
import {
  uploadDocuments,
  getCampaignDocuments,
  deleteDocument,
  getSellerDocuments,
} from "../controllers/documentController.js";
import { authUser } from "../middleware/authRoles.js";
import upload from "../config/multerConfig.js";

const router = express.Router();

// Route to upload documents to a campaign
router.post(
  "/campaign/:campaignId/upload",
  authUser,
  upload.array("documents", 5), // Allow up to 5 documents
  uploadDocuments
);

// Route to get all documents for a campaign
router.get("/campaign/:campaignId", getCampaignDocuments);

// Route to delete a specific document
router.delete(
  "/campaign/:campaignId/document/:documentId",
  authUser,
  deleteDocument
);

// Route to get all documents for a seller
router.get("/seller/:sellerId", authUser, getSellerDocuments);

export default router;
