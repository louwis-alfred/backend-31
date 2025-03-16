import mongoose from "mongoose";

const replySchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const campaignQuestionSchema = new mongoose.Schema({
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Campaign",
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  text: {
    type: String,
    required: true,
    trim: true,
  },
  replies: [replySchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Pre-save hook to update the updatedAt field
campaignQuestionSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Create indexes for faster queries
campaignQuestionSchema.index({ campaignId: 1, createdAt: -1 });

const CampaignQuestion = mongoose.model(
  "CampaignQuestion",
  campaignQuestionSchema
);

export default CampaignQuestion;
