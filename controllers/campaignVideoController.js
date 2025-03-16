import Campaign from "../models/campaignModel.js";
import cloudinary from "../config/cloudinaryConfig.js";
import fs from "fs";

// Add video to a campaign
export const addCampaignVideo = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { title, description } = req.body;
    
    // Check if campaign exists and belongs to this seller
    const campaign = await Campaign.findOne({ 
      _id: campaignId,
      sellerId: req.user._id
    });
    
    if (!campaign) {
      return res.status(404).json({ 
        success: false, 
        message: "Campaign not found or you don't have permission to modify it" 
      });
    }
    
    // Upload video to cloudinary
    let videoUrl = "";
    let thumbnailUrl = "";
    
    if (req.files && req.files.video) {
      const videoResult = await cloudinary.uploader.upload(req.files.video[0].path, {
        resource_type: "video",
        folder: "campaign-videos"
      });
      videoUrl = videoResult.secure_url;
      
      // Delete local file after upload
      fs.unlinkSync(req.files.video[0].path);
    }
    
    if (req.files && req.files.thumbnail) {
      const thumbnailResult = await cloudinary.uploader.upload(req.files.thumbnail[0].path, {
        folder: "campaign-thumbnails"
      });
      thumbnailUrl = thumbnailResult.secure_url;
      
      // Delete local file after upload
      fs.unlinkSync(req.files.thumbnail[0].path);
    }
    
    // Add video to campaign
    const newVideo = {
      url: videoUrl,
      title: title || campaign.title,
      description: description || "",
      thumbnail: thumbnailUrl,
      uploadDate: new Date()
    };
    
    campaign.videos.push(newVideo);
    
    // If this is the first video, set it as the main video
    if (!campaign.videoUrl) {
      campaign.videoUrl = videoUrl;
      campaign.thumbnail = thumbnailUrl;
    }
    
    await campaign.save();
    
    res.status(201).json({ 
      success: true, 
      message: "Video added successfully", 
      video: newVideo,
      campaign 
    });
  } catch (error) {
    console.error("Error adding campaign video:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while adding video", 
      error: error.message 
    });
  }
};

// Remove video from a campaign
export const removeCampaignVideo = async (req, res) => {
  try {
    const { campaignId, videoIndex } = req.params;
    
    // Check if campaign exists and belongs to this seller
    const campaign = await Campaign.findOne({ 
      _id: campaignId,
      sellerId: req.user._id
    });
    
    if (!campaign) {
      return res.status(404).json({ 
        success: false, 
        message: "Campaign not found or you don't have permission to modify it" 
      });
    }
    
    // Check if video index is valid
    if (!campaign.videos[videoIndex]) {
      return res.status(404).json({ 
        success: false, 
        message: "Video not found" 
      });
    }
    
    // Remove video from array
    campaign.videos.splice(videoIndex, 1);
    
    // If we removed the main video, update main video to the first one
    if (campaign.videos.length > 0) {
      campaign.videoUrl = campaign.videos[0].url;
      campaign.thumbnail = campaign.videos[0].thumbnail;
    } else {
      campaign.videoUrl = "";
      campaign.thumbnail = "";
    }
    
    await campaign.save();
    
    res.json({ 
      success: true, 
      message: "Video removed successfully",
      campaign 
    });
  } catch (error) {
    console.error("Error removing campaign video:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while removing video", 
      error: error.message 
    });
  }
};

// Set a video as the main campaign video
export const setMainCampaignVideo = async (req, res) => {
  try {
    const { campaignId, videoIndex } = req.params;
    
    // Check if campaign exists and belongs to this seller
    const campaign = await Campaign.findOne({ 
      _id: campaignId,
      sellerId: req.user._id
    });
    
    if (!campaign) {
      return res.status(404).json({ 
        success: false, 
        message: "Campaign not found or you don't have permission to modify it" 
      });
    }
    
    // Check if video index is valid
    if (!campaign.videos[videoIndex]) {
      return res.status(404).json({ 
        success: false, 
        message: "Video not found" 
      });
    }
    
    // Set as main video
    campaign.videoUrl = campaign.videos[videoIndex].url;
    campaign.thumbnail = campaign.videos[videoIndex].thumbnail;
    
    await campaign.save();
    
    res.json({ 
      success: true, 
      message: "Main video updated successfully",
      campaign 
    });
  } catch (error) {
    console.error("Error setting main campaign video:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while updating main video", 
      error: error.message 
    });
  }
};
