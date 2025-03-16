import mongoose from "mongoose";

const campaignSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "Agriculture",
        "Livestock",
        "Aquaculture",
        "Agri-tech",
        "Sustainable",
      ],
    },
    fundingGoal: {
      type: Number,
      required: true,
      default: 0,
    },
    currentFunding: {
      type: Number,
      default: 0,
    },
    expectedReturn: {
      type: Number,
      required: true,
      default: 0,
    },
    duration: {
      type: Number,
      required: true,
      default: 12, // months
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      default: "active",
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sellerName: String,
    sellerEmail: String,
    location: String,
    thumbnail: String,
    videoUrl: String,
    videos: [
      {
        url: String,
        title: String,
        description: String,
        thumbnail: String,
        uploadDate: { type: Date, default: Date.now },
      },
    ],
    verified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Add virtual field for daysLeft
campaignSchema.virtual("daysLeft").get(function () {
  if (!this.endDate) return 0;
  const now = new Date();
  const end = new Date(this.endDate);
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
});

// Ensure virtuals are included when converting to JSON
campaignSchema.set("toJSON", { virtuals: true });
campaignSchema.set("toObject", { virtuals: true });

const Campaign = mongoose.model("Campaign", campaignSchema);
export default Campaign;
