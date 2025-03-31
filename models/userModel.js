import mongoose from "mongoose";
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: { 
      type: String, 
      required: [true, 'Name is required'],
      trim: true
    },
    email: { 
      type: String, 
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
    },
    password: { 
      type: String, 
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false // Never return password in queries
    },
    
    // Role management
    role: {
      type: String,
      enum: {
        values: ["buyer", "seller", "investor"],
        message: 'Role must be either buyer, seller, or investor'
      },
      default: "buyer"
    },
    
    // Buyer-specific fields
    cartData: { 
      type: Object, 
      default: {} 
    },
    
    // Seller-specific fields
    businessName: { 
      type: String, 
      trim: true 
    },
    companyType: { 
      type: String, 
      trim: true 
    },
    province: { 
      type: String, 
      trim: true 
    },
    city: { 
      type: String, 
      trim: true 
    },
    farmLocation: { 
      type: String, 
      trim: true 
    },
    sellerContactNumber: { 
      type: String, 
      trim: true 
    },
    sellerDocument: { 
      type: String, 
      trim: true 
    },
    
    // Seller references
    products: [{
      type: Schema.Types.ObjectId,
      ref: "Product"
    }],
    sellerOrders: [{
      type: Schema.Types.ObjectId,
      ref: "Order"
    }],
    
    // Investor-specific fields
    investmentType: { 
      type: String, 
      trim: true 
    },
    companyName: { 
      type: String, 
      trim: true 
    },
    industry: { 
      type: String, 
      trim: true 
    },
    investorContactNumber: { 
      type: String, 
      trim: true 
    },
    investorDocument: { 
      type: String, 
      trim: true 
    },
    
    // Investment tracking
    totalInvested: {
      type: Number,
      default: 0,
      min: [0, 'Investment cannot be negative']
    },
    investments: [{
      type: Schema.Types.ObjectId,
      ref: "Investment",
    }],
    investmentStats: {
      totalConfirmed: { 
        type: Number, 
        default: 0,
        min: 0 
      },
      totalPending: { 
        type: Number, 
        default: 0,
        min: 0 
      },
      totalReturns: { 
        type: Number, 
        default: 0,
        min: 0 
      },
      activeInvestments: { 
        type: Number, 
        default: 0,
        min: 0 
      },
      lastInvestmentDate: Date
    }
  },
  { 
    minimize: false, 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);
userSchema.index({ role: 1 });  // Useful for role-based queries

const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;