import mongoose from "mongoose";

const sellerApplicationSchema = new mongoose.Schema({
  businessName: { type: String, required: true },
  companyType: { type: String, required: true },
  province: { type: String, required: true },
  city: { type: String, required: true },
  farmLocation: { type: String, required: true },
  contactNumber: { type: String, required: true },
  supportingDocument: { type: String, required: true },
});

const investorApplicationSchema = new mongoose.Schema(
  {
    investmentType: { type: String, required: true },
    companyName: { type: String },
    industry: { type: String },
    contactNumber: {
      type: String,
      required: true,
      match: [/^\+?\d{10,15}$/, "Please enter a valid contact number"],
    },
    supportingDocument: { type: String, required: true },
    investmentAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    cartData: { type: Object, default: {} },
    role: {
      type: [String],
      enum: ["user", "seller", "investor"],
      default: ["user"],
    },
    sellerApplication: { type: sellerApplicationSchema, default: null },
    investorApplication: { type: investorApplicationSchema, default: null },
    totalInvested: {
      type: Number,
      default: 0,
    },
    investments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Investment",
      },
    ],
    investmentStats: {
      totalConfirmed: {
        type: Number,
        default: 0,
      },
      totalPending: {
        type: Number,
        default: 0,
      },
      totalReturns: {
        type: Number,
        default: 0,
      },
      activeInvestments: {
        type: Number,
        default: 0,
      },
      lastInvestmentDate: Date,
    },
  },
  { minimize: false }
);

const userModel = mongoose.models.User || mongoose.model("User", userSchema);
export default userModel;
