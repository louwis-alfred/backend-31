import CampaignQuestion from "../models/campaignQuestionModel.js";
import User from "../models/userModel.js";
import Campaign from "../models/campaignModel.js";
import mongoose from "mongoose";

// Get all questions for a specific campaign
export const getCampaignQuestions = async (req, res) => {
  try {
    const { campaignId } = req.params;
    console.log(`Getting questions for campaign: ${campaignId}`);

    // Validate campaignId
    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid campaign ID",
      });
    }

    // Find questions for this campaign and populate user information
    const questions = await CampaignQuestion.find({ campaignId })
      .sort({ createdAt: -1 })
      .populate({
        path: "userId",
        select: "name email avatar role",
        // No need to specify model name if ref is correct in schema
      })
      .populate({
        path: "replies.userId",
        select: "name email avatar role",
        // No need to specify model name if ref is correct in schema
      })
      .lean();

    // Check if we found questions
    console.log(`Found ${questions.length} questions for campaign ${campaignId}`);

    // Transform questions to add user field expected by frontend
    const formattedQuestions = questions.map(question => {
      // Format replies to match frontend expectations
      const formattedReplies = question.replies?.map(reply => ({
        _id: reply._id,
        text: reply.text,
        createdAt: reply.createdAt,
        user: reply.userId || null // Rename userId to user for frontend
      })) || [];

      return {
        _id: question._id,
        text: question.text,
        createdAt: question.createdAt,
        user: question.userId || null, // Rename userId to user for frontend
        replies: formattedReplies
      };
    });

    return res.status(200).json({
      success: true,
      questions: formattedQuestions
    });
  } catch (error) {
    console.error("Error getting campaign questions:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get campaign questions",
      error: error.message
    });
  }
};

// Add a new question to a campaign
export const addCampaignQuestion = async (req, res) => {
  try {
    const { campaignId, text } = req.body;
    const userId = req.user._id;

    // Validate inputs
    if (!text || !campaignId) {
      return res.status(400).json({
        success: false,
        message: "Campaign ID and question text are required",
      });
    }

    // Validate campaignId
    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid campaign ID",
      });
    }

    // Check if campaign exists
    const campaignExists = await Campaign.exists({ _id: campaignId });
    if (!campaignExists) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    // Create the question
    const newQuestion = new CampaignQuestion({
      campaignId,
      userId,
      text,
      replies: [],
    });

    await newQuestion.save();

    // Get user info for response
    const user = await User.findById(userId).select("name email avatar role");

    // Format response
    const question = {
      _id: newQuestion._id,
      text: newQuestion.text,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        isSeller: user.role === "seller",
        isInvestor: user.role === "investor",
      },
      replies: [],
      campaignId: newQuestion.campaignId,
      createdAt: newQuestion.createdAt,
      updatedAt: newQuestion.updatedAt,
    };

    res.status(201).json({
      success: true,
      message: "Question added successfully",
      question,
    });
  } catch (error) {
    console.error("Error adding campaign question:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add question",
      error: error.message,
    });
  }
};

// Add a reply to a question
export const addReply = async (req, res) => {
  try {
    const { questionId, text } = req.body;
    const userId = req.user._id;

    // Validate inputs
    if (!text || !questionId) {
      return res.status(400).json({
        success: false,
        message: "Question ID and reply text are required",
      });
    }

    // Validate questionId
    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid question ID",
      });
    }

    // Find the question
    const question = await CampaignQuestion.findById(questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    // If user is not seller of campaign, check permissions
    const campaign = await Campaign.findById(question.campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    // Add the reply
    const reply = {
      text,
      userId,
      createdAt: new Date(),
    };

    question.replies.push(reply);
    await question.save();

    // Get user info for response
    const user = await User.findById(userId).select("name email avatar role");

    // Format response
    const formattedReply = {
      _id: question.replies[question.replies.length - 1]._id,
      text,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        isSeller: user.role === "seller",
        isInvestor: user.role === "investor",
      },
      createdAt: reply.createdAt,
    };

    res.status(201).json({
      success: true,
      message: "Reply added successfully",
      reply: formattedReply,
    });
  } catch (error) {
    console.error("Error adding reply:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add reply",
      error: error.message,
    });
  }
};

// Delete a question (only the user who asked or campaign owner can delete)
export const deleteQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    const userId = req.user._id;

    // Validate questionId
    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid question ID",
      });
    }

    // Find the question
    const question = await CampaignQuestion.findById(questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    // Check if user is question owner or campaign owner
    const campaign = await Campaign.findById(question.campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    // Check permissions
    const isQuestionOwner = question.userId.toString() === userId.toString();
    const isCampaignOwner = campaign.sellerId.toString() === userId.toString();

    if (!isQuestionOwner && !isCampaignOwner) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to delete this question",
      });
    }

    // Delete the question
    await CampaignQuestion.findByIdAndDelete(questionId);

    res.status(200).json({
      success: true,
      message: "Question deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting question:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete question",
      error: error.message,
    });
  }
};
