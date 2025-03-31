import Campaign from "../models/campaignModel.js";
import cloudinary from "../config/cloudinaryConfig.js";
import fs from "fs";
import User from "../models/userModel.js";
import investmentModel from "../models/investmentModel.js";

export const addCampaignVideo = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { title, description } = req.body;

    // Find the campaign
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    let videoUrl = "";
    let thumbnailUrl = "";

    // Handle video upload with improved error handling
    if (req.files && req.files.video && req.files.video[0]) {
      try {
        console.log("Starting video upload to Cloudinary...");

        // Use advanced upload options with improved error handling
        const videoResult = await cloudinary.uploader.upload(
          req.files.video[0].path,
          {
            resource_type: "video",
            folder: "campaign-videos",
            chunk_size: 6000000, // 6MB chunks
            timeout: 600000, // 10 minute timeout
            eager: [
              {
                format: "mp4",
                transformation: [{ quality: "auto" }, { fetch_format: "auto" }],
              },
            ],
            eager_async: true,
            eager_notification_url: `${req.protocol}://${req.get(
              "host"
            )}/api/cloudinary-notification`,
            format: "mp4", // Specify output format
            transformation: [
              { quality: "auto" }, // Auto-optimize quality
              { fetch_format: "auto" }, // Auto-select best delivery format
            ],
          }
        );

        console.log("Video upload successful:", videoResult.secure_url);
        videoUrl = videoResult.secure_url;

        // Clean up the temporary file
        fs.unlinkSync(req.files.video[0].path);
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload video to cloud storage",
          error: uploadError.message,
        });
      }
    }

    // Handle thumbnail upload if provided
    if (req.files && req.files.thumbnail && req.files.thumbnail[0]) {
      try {
        const thumbnailResult = await cloudinary.uploader.upload(
          req.files.thumbnail[0].path,
          {
            folder: "campaign-thumbnails",
          }
        );

        thumbnailUrl = thumbnailResult.secure_url;

        // Clean up the temporary file
        fs.unlinkSync(req.files.thumbnail[0].path);
      } catch (thumbnailError) {
        console.error("Thumbnail upload error:", thumbnailError);
        // Continue even if thumbnail fails - just log it
      }
    }

    // Add video to campaign videos array
    campaign.videos.push({
      url: videoUrl,
      title: title || `Video ${campaign.videos.length + 1}`,
      description: description || "",
      thumbnail: thumbnailUrl,
      uploadDate: new Date(),
    });

    // If this is the first video, set it as main video
    if (!campaign.videoUrl && videoUrl) {
      campaign.videoUrl = videoUrl;
    }

    // Save the campaign
    await campaign.save();

    res.status(200).json({
      success: true,
      message: "Video added to campaign successfully",
      campaign: campaign,
    });
  } catch (error) {
    console.error("Error adding campaign video:", error);
    res.status(500).json({
      success: false,
      message: "Error adding campaign video",
      error: error.message,
    });
  }
};

// Create a new campaign (for sellers only)
export const createCampaign = async (req, res) => {
  try {
    const { title, description, category, endDate } = req.body;

    // Validate role - only sellers can create campaigns
    // UPDATED: Changed from includes() to exact match
    if (req.user.role !== "seller") {
      return res.status(403).json({
        success: false,
        message: "Only sellers can create campaigns",
      });
    }

    console.log("Creating campaign with files:", req.files);

    // Create campaign object - remove targetAmount requirement
    const campaign = new Campaign({
      title,
      description,
      sellerId: req.user._id,
      sellerName: req.user.name,
      sellerEmail: req.user.email,
      viewCount: 0, // Initialize view count instead of targetAmount
      category,
      endDate: new Date(endDate),
      videos: [],
      creatorType: "seller",
      status: "active",
    });

    // Handle video uploads if present
    if (req.files && req.files.video && req.files.video[0]) {
      try {
        console.log("Uploading video to cloudinary...");

        const result = await cloudinary.uploader.upload(
          req.files.video[0].path,
          {
            resource_type: "video",
            folder: "campaign-videos",
            chunk_size: 6000000, // 6MB chunks for large videos
            timeout: 600000, // 10 minute timeout
          }
        );

        console.log("Video upload success:", result.secure_url);

        // Store as structured video object
        campaign.videos.push({
          url: result.secure_url,
          title: campaign.title,
          description: "",
          thumbnail: "",
          uploadDate: new Date(),
        });

        // Also set as main video
        campaign.videoUrl = result.secure_url;

        // Clean up the temporary file
        fs.unlinkSync(req.files.video[0].path);
      } catch (uploadError) {
        console.error("Video upload failed:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Video upload failed",
          error: uploadError.message,
        });
      }
    }

    // Handle thumbnail if present
    if (req.files && req.files.thumbnail && req.files.thumbnail[0]) {
      try {
        const thumbnailResult = await cloudinary.uploader.upload(
          req.files.thumbnail[0].path,
          {
            folder: "campaign-thumbnails",
          }
        );

        campaign.thumbnail = thumbnailResult.secure_url;

        if (campaign.videos.length > 0) {
          campaign.videos[0].thumbnail = thumbnailResult.secure_url;
        }

        // Clean up the temporary file
        fs.unlinkSync(req.files.thumbnail[0].path);
      } catch (thumbnailError) {
        console.error("Thumbnail upload error:", thumbnailError);
        // Continue even if thumbnail fails
      }
    }

    // Save the campaign
    await campaign.save();

    res.status(201).json({
      success: true,
      message: "Campaign created successfully",
      campaign,
    });
  } catch (error) {
    console.error("Error creating campaign:", error);
    res.status(500).json({
      success: false,
      message: "Error creating campaign",
      error: error.message,
    });
  }
};

// Get all campaigns
export const getAllCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find()
      .populate('sellerId', 'name email location')
      .sort({ createdAt: -1 });

    const formattedCampaigns = campaigns.map(campaign => ({
      _id: campaign._id,
      title: campaign.title,
      description: campaign.description,
      category: campaign.category,
      fundingGoal: campaign.fundingGoal,
      currentFunding: campaign.currentFunding,
      expectedReturn: campaign.expectedReturn,
      duration: campaign.duration,
      daysLeft: campaign.daysLeft,
      status: campaign.status,
      sellerName: campaign.sellerName || campaign.sellerId?.name,
      sellerEmail: campaign.sellerEmail || campaign.sellerId?.email,
      location: campaign.location || campaign.sellerId?.location,
      thumbnail: campaign.thumbnail,
      videoUrl: campaign.videoUrl,
      videos: campaign.videos || [],
      verified: campaign.verified,
      createdAt: campaign.createdAt
    }));

    res.json({
      success: true,
      campaigns: formattedCampaigns
    });
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get campaigns by investor ID
export const getInvestorCampaigns = async (req, res) => {
  try {
    const { investorId } = req.params;
    const campaigns = await Campaign.find({ investorId }).sort({
      createdAt: -1,
    });
    res.json({ success: true, campaigns });
  } catch (error) {
    console.error("Error fetching investor campaigns:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get campaigns by seller ID
export const getSellerCampaigns = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const campaigns = await Campaign.find({ sellerId }).sort({ createdAt: -1 });
    res.json({ success: true, campaigns });
  } catch (error) {
    console.error("Error fetching seller campaigns:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id).populate({
      path: "sellerId",
      model: "User",
      select: "name email phone location businessName companyType province city farmLocation sellerContactNumber sellerDocument"
    });

    if (!campaign) {
      return res.status(404).json({ 
        success: false, 
        message: "Campaign not found" 
      });
    }

    // UPDATED: Changed to access direct fields instead of sellerApplication nested object
    const formattedCampaign = {
      ...campaign._doc,
      sellerName: campaign.sellerId?.name || "Unknown Seller",
      sellerEmail: campaign.sellerId?.email,
      sellerPhone: campaign.sellerId?.phone || campaign.sellerId?.sellerContactNumber,
      sellerLocation: campaign.sellerId?.location || campaign.sellerId?.farmLocation,
      sellerBusinessName: campaign.sellerId?.businessName,
      // Direct access to seller fields
      companyType: campaign.sellerId?.companyType,
      province: campaign.sellerId?.province,
      city: campaign.sellerId?.city,
      farmLocation: campaign.sellerId?.farmLocation,
      contactNumber: campaign.sellerId?.sellerContactNumber,
      sellerDocument: campaign.sellerId?.sellerDocument
    };

    res.json({ 
      success: true, 
      campaign: formattedCampaign 
    });
  } catch (error) {
    console.error("Error fetching campaign:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Update a campaign
export const updateCampaign = async (req, res) => {
  try {
    const campaignId = req.params.id;
    const updatedData = req.body;

    // Ensure only the owner can update
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res
        .status(404)
        .json({ success: false, message: "Campaign not found" });
    }

    // Check ownership - admin or creator (investor or seller)
    const isOwner =
      (campaign.investorId &&
        campaign.investorId.toString() === req.user._id.toString()) ||
      (campaign.sellerId &&
        campaign.sellerId.toString() === req.user._id.toString());

    // UPDATED: Changed from includes() to exact match
    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this campaign",
      });
    }

    const updatedCampaign = await Campaign.findByIdAndUpdate(
      campaignId,
      updatedData,
      { new: true }
    );

    res.json({ success: true, campaign: updatedCampaign });
  } catch (error) {
    console.error("Error updating campaign:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a campaign
export const deleteCampaign = async (req, res) => {
  try {
    const campaignId = req.params.id;

    // Ensure only the owner can delete
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res
        .status(404)
        .json({ success: false, message: "Campaign not found" });
    }

    // Check ownership - admin or creator (investor or seller)
    const isOwner =
      (campaign.investorId &&
        campaign.investorId.toString() === req.user._id.toString()) ||
      (campaign.sellerId &&
        campaign.sellerId.toString() === req.user._id.toString());

    // UPDATED: Changed from includes() to exact match
    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this campaign",
      });
    }

    await Campaign.findByIdAndDelete(campaignId);
    res.json({ success: true, message: "Campaign deleted successfully" });
  } catch (error) {
    console.error("Error deleting campaign:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get featured or top campaigns
export const getFeaturedCampaigns = async (req, res) => {
  try {
    // Get campaigns with highest funding or most recent
    const campaigns = await Campaign.find({ status: "active" })
      .sort({ currentAmount: -1, createdAt: -1 })
      .limit(4);

    res.json({ success: true, campaigns });
  } catch (error) {
    console.error("Error fetching featured campaigns:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCampaignBackers = async (req, res) => {
  try {
    const { campaignId } = req.params;

    const investments = await investmentModel
      .find({
        campaignId,
        status: "approved", // Only show approved investments
        payment: true, // Only show paid investments
      })
      .populate("userId", "name email")
      .select("amount date userId")
      .sort("-amount");

    // Group investments by user
    const backers = investments.reduce((acc, inv) => {
      const existingBacker = acc.find(
        (b) => b.userId._id.toString() === inv.userId._id.toString()
      );

      if (existingBacker) {
        existingBacker.totalAmount += inv.amount;
        existingBacker.investments.push({
          amount: inv.amount,
          date: inv.date,
        });
      } else {
        acc.push({
          userId: inv.userId,
          totalAmount: inv.amount,
          investments: [
            {
              amount: inv.amount,
              date: inv.date,
            },
          ],
        });
      }

      return acc;
    }, []);

    res.json({
      success: true,
      backers,
      totalBackers: backers.length,
      totalInvested: backers.reduce((sum, b) => sum + b.totalAmount, 0),
    });
  } catch (error) {
    console.error("Error fetching campaign backers:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve campaign backers",
    });
  }
};