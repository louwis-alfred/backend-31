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
      paymentMethod: "COD", // Changed to COD only
      status: "pending", // Always starts as pending
      payment: false, // Payment status false by default
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
// Confirm an investment and mark it as paid
const confirmInvestment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      investmentId,
      paymentDetails = {},
      adminNotes = "",
      confirmedBy,
    } = req.body;

    // Find the investment
    const investment = await investmentModel
      .findById(investmentId)
      .session(session);

    if (!investment) {
      return res.status(404).json({
        success: false,
        message: "Investment not found",
      });
    }

    // If investment is already confirmed, prevent duplicate confirmation
    if (investment.payment) {
      return res.status(400).json({
        success: false,
        message: "Investment is already confirmed and paid",
      });
    }

    // Find related campaign and user
    const campaign = await campaignModel
      .findById(investment.campaignId)
      .session(session);
    const user = await userModel.findById(investment.userId).session(session);

    if (!campaign || !user) {
      return res.status(404).json({
        success: false,
        message: "Associated campaign or user not found",
      });
    }

    // Update investment status
    investment.status = "approved";
    investment.payment = true;
    investment.paymentConfirmedAt = new Date();
    investment.paymentDetails = {
      ...paymentDetails,
      confirmedBy,
      confirmationDate: new Date(),
      notes: adminNotes,
    };

    await investment.save({ session });

    // Update campaign funding - add the investment amount to the current funding
    campaign.currentAmount = (campaign.currentAmount || 0) + investment.amount;

    // Add investor to backers list if not already there
    const existingBacker = campaign.backers?.find(
      (backer) => backer.userId.toString() === investment.userId.toString()
    );

    if (!existingBacker) {
      campaign.backers = [
        ...(campaign.backers || []),
        {
          userId: investment.userId,
          amount: investment.amount,
          date: new Date(),
        },
      ];
    } else {
      // Update existing backer amount
      campaign.backers = campaign.backers.map((backer) => {
        if (backer.userId.toString() === investment.userId.toString()) {
          return {
            ...backer,
            amount: backer.amount + investment.amount,
            date: new Date(),
          };
        }
        return backer;
      });
    }

    await campaign.save({ session });

    // Update user's investment statistics
    user.totalInvested = (user.totalInvested || 0) + investment.amount;
    user.investmentStats = {
      ...(user.investmentStats || {}),
      totalConfirmed:
        (user.investmentStats?.totalConfirmed || 0) + investment.amount,
      lastInvestmentDate: new Date(),
    };

    await user.save({ session });

    // Generate receipt data
    const receiptData = {
      receiptNumber: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      investmentId: investment._id,
      amount: investment.amount,
      investor: {
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
      campaign: {
        title: campaign.title,
        id: campaign._id,
      },
      paymentMethod: "COD",
      paymentDate: new Date(),
      confirmedBy,
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
    // Abort transaction on error
    await session.abortTransaction();
    session.endSession();

    console.error("Error confirming investment:", error);
    return res.status(500).json({
      success: false,
      message:
        error.message || "An error occurred while confirming the investment",
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

// Accept investment by seller
const acceptInvestment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { investmentId } = req.body;
    const sellerId = req.user._id;

    const investment = await investmentModel
      .findById(investmentId)
      .session(session);

    if (!investment) {
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
      return res.status(404).json({
        success: false,
        message: "Associated campaign not found",
      });
    }

    // Verify that the logged-in seller owns this campaign
    if (campaign.sellerId.toString() !== sellerId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to accept this investment",
      });
    }

    // Update investment status
    investment.status = "accepted";
    investment.sellerAcceptedAt = new Date();
    await investment.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Investment accepted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error accepting investment:", error);
    return res.status(500).json({
      success: false,
      message:
        error.message || "An error occurred while accepting the investment",
    });
  }
};

// Complete investment negotiation
const completeInvestmentNegotiation = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { investmentId, notes } = req.body;
    const sellerId = req.user._id;

    const investment = await investmentModel
      .findById(investmentId)
      .session(session);

    if (!investment) {
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
      return res.status(404).json({
        success: false,
        message: "Associated campaign not found",
      });
    }

    // Verify that the logged-in seller owns this campaign
    if (campaign.sellerId.toString() !== sellerId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to complete this investment",
      });
    }

    // Update investment status to completed
    investment.status = "completed";
    investment.completedAt = new Date();
    investment.completionNotes = notes || "Investment completed successfully";
    await investment.save({ session });

    // Update campaign funding amount if it wasn't already counted
    if (!investment.countedInFunding) {
      campaign.currentAmount =
        (campaign.currentAmount || 0) + investment.amount;
      campaign.completedInvestmentsCount =
        (campaign.completedInvestmentsCount || 0) + 1;
      campaign.completedInvestmentsAmount =
        (campaign.completedInvestmentsAmount || 0) + investment.amount;
      await campaign.save({ session });

      investment.countedInFunding = true;
      await investment.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Investment negotiation completed successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error completing investment:", error);
    return res.status(500).json({
      success: false,
      message:
        error.message || "An error occurred while completing the investment",
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
  confirmInvestment, // Add this export
  acceptInvestment,
  completeInvestmentNegotiation,
  getCompletedInvestmentsByCampaign,
};
