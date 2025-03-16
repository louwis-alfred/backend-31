import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative"],
    },
    images: {
      type: [String],
      required: true,
      validate: [(arr) => arr.length > 0, "At least one image required"],
    },
    category: {
      type: String,
      required: true,
      enum: ["Vegetables", "Fruits", "Grains", "Root Crops", "Herbs", "Others"],
    },
    freshness: {
      type: String,
      enum: ["Fresh", "Day-old", "Stored", "Processed"],
      default: "Fresh",
    },
    unitOfMeasurement: {
      type: String,
      enum: ["kg", "g", "pc", "bundle", "pack", "lbs", "oz"],
      required: true,
    },
    origin: {
      tradeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Trade"
      },
      originalProductId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
      },
      originalSellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      acquiredDate: {
        type: Date
      }
    },
    stock: {
      type: Number,
      required: true,
      min: [0, "Stock cannot be negative"],
    },
    tradeHistory: [
      {
        tradeId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Trade",
        },
        tradedTo: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        tradedFrom: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        date: {
          type: Date,
          default: Date.now,
        },
        quantity: Number,
        newOwner: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    isActive: { type: Boolean, default: true },
    availableForTrade: { type: Boolean, default: false },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
productSchema.index({ category: 1 });
productSchema.index({ sellerId: 1 });
productSchema.index({ isActive: 1, stock: 1 });

// Pre-save middleware
productSchema.pre("save", function (next) {
  this.isActive = this.stock > 0;
  next();
});

const productModel =
  mongoose.models.Product || mongoose.model("Product", productSchema);
export default productModel;
