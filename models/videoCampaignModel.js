import mongoose from "mongoose";

const videoCampaignSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  videoUrl: { type: String, required: true }, // Make sure this is defined
  category: { type: String, required: true },
  createdBy: { type: String, default: "admin" },
}, { timestamps: true });

const VideoCampaign = mongoose.model("VideoCampaign", videoCampaignSchema);
export default VideoCampaign;