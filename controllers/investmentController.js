import investmentModel from "../models/investmentModel.js";
import userModel from "../models/userModel.js";
import campaignModel from "../models/campaignModel.js";
import mongoose from "mongoose";

export const getRecentInvestmentsByCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;

    const recentInvestments = await investmentModel
      .find({
        campaignId,
        status: { $in: ["approved", "accepted", "completed"] },
      })
      .populate("userId", "name email")
      .sort("-date")
      .limit(5); // Only get the most recent 5

    return res.status(200).json({
      success: true,
      investments: recentInvestments,
    });
  } catch (error) {
    console.error("Error fetching recent investments:", error);
    return res.status(500).json({
      success: false,
      message:
        error.message || "An error occurred while fetching recent investments",
    });
  }
};


// Placing investments
const placeInvestment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { campaignId, amount } = req.body;
    const userId = req.user._id;

    // Validate investment amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid investment amount",
      });
    }

    // Verify campaign exists
    const campaign = await campaignModel.findById(campaignId).session(session);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    // Check if campaign has minimum investment
    if (campaign.minimumInvestment && amount < campaign.minimumInvestment) {
      return res.status(400).json({
        success: false,
        message: `Minimum investment amount is ₱${campaign.minimumInvestment}`,
      });
    }

    // Create investment record (default to pending with COD payment)
    const investment = new investmentModel({
      userId,
      campaignId,
      amount,
      paymentMethod: "COD", 
      status: "pending", 
      payment: false,
    });

    await investment.save({ session });

    // Always increment investor count
    campaign.investorsCount = (campaign.investorsCount || 0) + 1;
    await campaign.save({ session });

    // Update user's investments
    await userModel.findByIdAndUpdate(
      userId,
      {
        $addToSet: { investments: investment._id },
      },
      { session }
    );

    // If everything succeeds, commit transaction
    await session.commitTransaction();
    session.endSession();

    // Return success with investment ID
    return res.status(201).json({
      success: true,
      message: "Investment request submitted and pending confirmation",
      investmentId: investment._id,
      amount,
      status: investment.status
    });
  } catch (error) {
    // If anything fails, abort transaction
    await session.abortTransaction();
    session.endSession();

    console.error("Error processing investment:", error);
    return res.status(500).json({
      success: false,
      message:
        error.message || "An error occurred while processing your investment",
    });
  }
};
// Confirm an investment and mark it as paid (now seller-managed)
// Confirm an investment and mark it as paid (seller-managed with JWT auth)
const confirmInvestment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Get investment ID either from request body or URL parameter
    const investmentId = req.params.investmentId || req.body.investmentId;
    const {
      paymentDetails = {},
      notes = "",
    } = req.body;
    
    // Make sure user is authenticated and is a seller
    if (!req.user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (req.user.role !== 'seller') {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: "Only sellers can confirm investments",
      });
    }

    const sellerId = req.user._id;

    if (!investmentId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Investment ID is required",
      });
    }

    const investment = await investmentModel
      .findById(investmentId)
      .session(session);

    if (!investment) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Investment not found",
      });
    }

    // Find related campaign and verify seller ownership
    const campaign = await campaignModel
      .findById(investment.campaignId)
      .session(session);
    
    if (!campaign) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Associated campaign not found",
      });
    }
    
    // Verify that the logged-in seller owns this campaign
    if (campaign.sellerId.toString() !== sellerId.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: "You are not authorized to confirm this investment. Only the campaign owner can confirm investments.",
      });
    }

    const user = await userModel
      .findById(investment.userId)
      .session(session);

    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Investor not found",
      });
    }

    // Update investment status
    investment.status = "approved";
    investment.payment = true;
    investment.paymentConfirmedAt = new Date();
    investment.paymentDetails = {
      ...paymentDetails,
      confirmedBy: sellerId,
      confirmationDate: new Date(),
      notes: notes,
    };

    await investment.save({ session });

    // Generate receipt data
    const receiptData = {
      receiptNumber: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      investmentId: investment._id,
      amount: investment.amount,
      investor: {
        name: user.name,
        email: user.email,
        phone: user.phone || "N/A",
      },
      campaign: {
        title: campaign.title,
        id: campaign._id,
      },
      paymentMethod: investment.paymentMethod,
      paymentDate: new Date(),
      confirmedBy: sellerId,
      status: "PAID",
    };

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Investment confirmed successfully",
      investment,
      receipt: receiptData,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error confirming investment:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "An error occurred while confirming the investment",
    });
  }
};
// All investments data from admin panel
const allInvestments = async (req, res) => {
  try {
    const investments = await investmentModel.find({});
    res.json({ success: true, investments });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};
// User's investments
const userInvestments = async (req, res) => {
  try {
    const userId = req.body.userId || req.user._id;
    const investments = await investmentModel.find({ userId });
    res.json({ success: true, investments });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};
// Reject an investment by seller
const rejectInvestment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Get investment ID either from request body or URL parameter
    const investmentId = req.params.investmentId || req.body.investmentId;
    const { reason = "Investment rejected by seller" } = req.body;
    const sellerId = req.user._id;

    if (!investmentId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Investment ID is required",
      });
    }

    const investment = await investmentModel
      .findById(investmentId)
      .session(session);

    if (!investment) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Investment not found",
      });
    }

    // Find the campaign to verify the seller
    const campaign = await campaignModel
      .findById(investment.campaignId)
      .session(session);

    if (!campaign) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Associated campaign not found",
      });
    }

    // Verify that the logged-in seller owns this campaign
    if (campaign.sellerId.toString() !== sellerId.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: "You are not authorized to reject this investment",
      });
    }

    // Update investment status
    investment.status = "rejected";
    investment.rejectedAt = new Date();
    investment.rejectionReason = reason;
    investment.rejectedBy = sellerId;
    await investment.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Investment rejected successfully",
      investment: investment
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error rejecting investment:", error);
    return res.status(500).json({
      success: false,
      message:
        error.message || "An error occurred while rejecting the investment",
    });
  }
};
// Update investment status from admin
const updateInvestmentStatus = async (req, res) => {
  try {
    const { investmentId, status } = req.body;
    await investmentModel.findByIdAndUpdate(investmentId, { status });
    res.json({ success: true, message: "Status Updated" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Get investments by campaign ID
// Update getInvestmentsByCampaign function in investmentController.js
const getInvestmentsByCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const investments = await investmentModel
      .find({ campaignId })
      .populate("userId", "name email role investmentType")
      .sort("-date");

    res.json({
      success: true,
      investments,
      totalAmount: investments.reduce((sum, inv) => sum + inv.amount, 0),
      count: investments.length,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};
// Get investment history with filtering options
const getInvestmentHistory = async (req, res) => {
  try {
    const { campaignId, status, startDate, endDate, limit = 20, page = 1 } = req.query;
    
    // Build query object
    const query = {};
    
    // Filter by campaign if provided
    if (campaignId) {
      query.campaignId = campaignId;
    }
    
    // Filter by status if provided (can be a comma-separated list)
    if (status) {
      const statusArray = status.split(',').map(s => s.trim());
      query.status = { $in: statusArray };
    }
    
    // Filter by date range if provided
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }
    
    // If user is not admin/seller, restrict to their own investments
    if (req.user.role !== 'admin' && req.user.role !== 'seller') {
      query.userId = req.user._id;
    }
    
    // Count total matching documents for pagination
    const total = await investmentModel.countDocuments(query);
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Execute query with pagination
    const investments = await investmentModel
      .find(query)
      .populate("userId", "name email phone")
      .populate("campaignId", "title description")
      .sort("-date")
      .skip(skip)
      .limit(parseInt(limit));
    
    // Group investments by status for quick stats
    const statusCounts = await investmentModel.aggregate([
      { $match: query },
      { $group: { _id: "$status", count: { $sum: 1 }, totalAmount: { $sum: "$amount" } } }
    ]);
    
    return res.status(200).json({
      success: true,
      investments,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      },
      stats: {
        totalInvestments: total,
        statusBreakdown: statusCounts,
        totalAmount: investments.reduce((sum, inv) => sum + inv.amount, 0),
      }
    });
  } catch (error) {
    console.error("Error fetching investment history:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "An error occurred while fetching investment history",
    });
  }
};
// Get rejected investments by campaign ID
const getRejectedInvestmentsByCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;

    const rejectedInvestments = await investmentModel
      .find({
        campaignId,
        status: "rejected",
      })
      .populate("userId", "name email")
      .sort("-rejectedAt");

    return res.status(200).json({
      success: true,
      rejectedInvestments,
      totalAmount: rejectedInvestments.reduce(
        (sum, inv) => sum + inv.amount,
        0
      ),
      count: rejectedInvestments.length,
    });
  } catch (error) {
    console.error("Error fetching rejected investments:", error);
    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "An error occurred while fetching rejected investments",
    });
  }
};
const acceptInvestment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Get investment ID either from request body or URL parameter
    const investmentId = req.params.investmentId || req.body.investmentId;
    const { notes = "" } = req.body;
    const sellerId = req.user._id;

    if (!investmentId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Investment ID is required",
      });
    }

    const investment = await investmentModel
      .findById(investmentId)
      .session(session);

    if (!investment) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Investment not found",
      });
    }

    // Check if investment is in the correct status (now allowing pending or approved)
    if (!["pending", "approved"].includes(investment.status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Only pending or approved investments can be accepted",
      });
    }

    // Find the campaign to verify the seller
    const campaign = await campaignModel
      .findById(investment.campaignId)
      .session(session);

    if (!campaign) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Associated campaign not found",
      });
    }

    // Verify that the logged-in seller owns this campaign
    if (campaign.sellerId.toString() !== sellerId.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: "You are not authorized to accept this investment",
      });
    }

    // Find the investor
    const investor = await userModel
      .findById(investment.userId)
      .session(session);

    if (!investor) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Investor not found",
      });
    }

    // If the investment is still pending, mark it as approved first
    if (investment.status === "pending") {
      investment.status = "approved";
      investment.payment = true;
      investment.paymentConfirmedAt = new Date();
      investment.paymentDetails = {
        confirmedBy: sellerId,
        confirmationDate: new Date(),
        notes: "Auto-confirmed during acceptance",
      };
    }

    // Update investment status to accepted
    const previousStatus = investment.status;
    investment.status = "accepted";
    investment.sellerAcceptedAt = new Date();

    // Then also mark it as completed (combining the completion step)
    investment.status = "completed";
    investment.completedAt = new Date();
    investment.completionNotes = notes;
    investment.countedInFunding = true;

    // Update campaign funding metrics
    campaign.currentAmount = (campaign.currentAmount || 0) + investment.amount;
    campaign.completedInvestmentsCount = (campaign.completedInvestmentsCount || 0) + 1;
    campaign.completedInvestmentsAmount = (campaign.completedInvestmentsAmount || 0) + investment.amount;
    
    // Update progress percentage
    if (campaign.targetAmount) {
      campaign.progressPercentage = (campaign.currentAmount / campaign.targetAmount) * 100;
    }

    // Save both the investment and campaign changes
    await investment.save({ session });
    await campaign.save({ session });

    // Generate receipt/confirmation data
    const confirmationData = {
      investmentId: investment._id,
      amount: investment.amount,
      investor: {
        name: investor.name,
        email: investor.email,
        phone: investor.phone || "N/A",
      },
      campaign: {
        title: campaign.title,
        id: campaign._id,
        currentAmount: campaign.currentAmount,
        progressPercentage: campaign.progressPercentage
      },
      previousStatus,
      currentStatus: "completed",
      acceptedAndCompletedAt: new Date(),
      notes
    };

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Investment accepted and completed successfully",
      investment: investment,
      campaign: {
        currentAmount: campaign.currentAmount,
        progressPercentage: campaign.progressPercentage,
        completedInvestmentsCount: campaign.completedInvestmentsCount
      },
      confirmation: confirmationData
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error accepting/completing investment:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "An error occurred while processing the investment",
    });
  }
};


// Get completed investments by campaign ID
const getCompletedInvestmentsByCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;

    const completedInvestments = await investmentModel
      .find({
        campaignId,
        status: "completed",
      })
      .populate("userId", "name email")
      .sort("-completedAt");

    return res.status(200).json({
      success: true,
      completedInvestments,
      totalAmount: completedInvestments.reduce(
        (sum, inv) => sum + inv.amount,
        0
      ),
      count: completedInvestments.length,
    });
  } catch (error) {
    console.error("Error fetching completed investments:", error);
    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "An error occurred while fetching completed investments",
    });
  }
};
export {
  placeInvestment,
  allInvestments,
  userInvestments,
  updateInvestmentStatus,
  getInvestmentsByCampaign,
  confirmInvestment,
  acceptInvestment,
  rejectInvestment,
  getCompletedInvestmentsByCampaign,
  getRejectedInvestmentsByCampaign,
  getInvestmentHistory,
};
