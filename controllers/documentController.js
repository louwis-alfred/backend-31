import mongoose from "mongoose";
import cloudinary from "../config/cloudinaryConfig.js";
import Campaign from "../models/campaignModel.js";
import User from "../models/userModel.js";
import fs from "fs";
import path from "path";

// Upload documents for a campaign
export const uploadDocuments = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
    }

    // Find the campaign
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    // Check if user is the campaign owner
    if (campaign.sellerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to upload documents to this campaign",
      });
    }

    const uploadedDocs = [];

    // Upload each file to cloudinary
    for (const file of files) {
      try {
        // Upload to cloudinary
        const result = await cloudinary.uploader.upload(file.path, {
          folder: `agriculture/documents/${campaignId}`,
          resource_type: "auto",
        });

        // Add to uploaded docs array
        uploadedDocs.push({
          url: result.secure_url,
          publicId: result.public_id,
          name: file.originalname,
          type: file.mimetype,
          size: file.size,
        });

        // Delete the local file after upload
        fs.unlinkSync(file.path);
      } catch (error) {
        console.error("Error uploading document to cloudinary:", error);
      }
    }

    // Update campaign with new documents
    if (!campaign.supportingDocuments) {
      campaign.supportingDocuments = [];
    }

    campaign.supportingDocuments = [
      ...campaign.supportingDocuments,
      ...uploadedDocs,
    ];
    await campaign.save();

    res.status(200).json({
      success: true,
      message: "Documents uploaded successfully",
      documents: uploadedDocs,
    });
  } catch (error) {
    console.error("Error uploading documents:", error);
    res.status(500).json({
      success: false,
      message: "Error uploading documents",
      error: error.message,
    });
  }
};

// Get all documents for a campaign
export const getCampaignDocuments = async (req, res) => {
  try {
    const { campaignId } = req.params;

    const campaign = await Campaign.findById(campaignId)
      .select("supportingDocuments supportingDocument title sellerId")
      .populate("sellerId", "name email");

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    // Combine all available documents
    let documents = [];

    // Add main supporting document if exists
    if (campaign.supportingDocument) {
      documents.push({
        url: campaign.supportingDocument,
        name: `${campaign.title} - Main Document`,
        type: getDocumentType(campaign.supportingDocument),
      });
    }

    // Add additional supporting documents if they exist
    if (
      campaign.supportingDocuments &&
      campaign.supportingDocuments.length > 0
    ) {
      documents = [...documents, ...campaign.supportingDocuments];
    }

    res.status(200).json({
      success: true,
      documents,
      campaign: {
        _id: campaign._id,
        title: campaign.title,
        seller: campaign.sellerId,
      },
    });
  } catch (error) {
    console.error("Error fetching campaign documents:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching documents",
      error: error.message,
    });
  }
};

// Delete a document
export const deleteDocument = async (req, res) => {
  try {
    const { campaignId, documentId } = req.params;

    // Find the campaign
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    // Check if user is the campaign owner
    if (campaign.sellerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete documents from this campaign",
      });
    }

    // Find the document in the array
    const docIndex = campaign.supportingDocuments.findIndex(
      (doc) => doc._id.toString() === documentId
    );

    if (docIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Get the document to delete
    const docToDelete = campaign.supportingDocuments[docIndex];

    // Delete from cloudinary if it has a public ID
    if (docToDelete.publicId) {
      await cloudinary.uploader.destroy(docToDelete.publicId);
    }

    // Remove from the array
    campaign.supportingDocuments.splice(docIndex, 1);
    await campaign.save();

    res.status(200).json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting document",
      error: error.message,
    });
  }
};

// Get all documents for a seller
export const getSellerDocuments = async (req, res) => {
  try {
    const { sellerId } = req.params;

    // Find all campaigns by this seller
    const campaigns = await Campaign.find({ sellerId }).select(
      "_id title supportingDocuments supportingDocument"
    );

    if (!campaigns || campaigns.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No campaigns found for this seller",
      });
    }

    // Get all documents across all campaigns
    const documentsGrouped = campaigns.map((campaign) => {
      const docs = [];

      // Add main supporting document if it exists
      if (campaign.supportingDocument) {
        docs.push({
          url: campaign.supportingDocument,
          name: `${campaign.title} - Main Document`,
          campaignId: campaign._id,
          campaignTitle: campaign.title,
        });
      }

      // Add additional supporting documents if they exist
      if (
        campaign.supportingDocuments &&
        campaign.supportingDocuments.length > 0
      ) {
        campaign.supportingDocuments.forEach((doc) => {
          docs.push({
            ...doc.toObject(),
            campaignId: campaign._id,
            campaignTitle: campaign.title,
          });
        });
      }

      return {
        campaignId: campaign._id,
        campaignTitle: campaign.title,
        documents: docs,
      };
    });

    res.status(200).json({
      success: true,
      documentsByCampaign: documentsGrouped,
    });
  } catch (error) {
    console.error("Error fetching seller documents:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching seller documents",
      error: error.message,
    });
  }
};

// Helper function to determine document type from URL
const getDocumentType = (url) => {
  if (!url) return "unknown";
  const lowercaseUrl = url.toLowerCase();
  if (lowercaseUrl.endsWith(".pdf")) return "pdf";
  if (lowercaseUrl.match(/\.(jpe?g|png|gif|bmp|webp)$/)) return "image";
  if (lowercaseUrl.match(/\.(docx?|xlsx?|pptx?|txt|csv)$/)) return "document";
  return "unknown";
};
