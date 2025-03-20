import mongoose from "mongoose";

const tradeSchema = new mongoose.Schema({
  sellerFrom: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  sellerTo: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  productFrom: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true 
  },
  productTo: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true 
  },
  quantity: { 
    type: Number, 
    required: true,
    min: [1, 'Quantity must be at least 1']
  },
fromDeliveryConfirmed: {
  type: Boolean,
  default: false
},
toDeliveryConfirmed: {
  type: Boolean,
  default: false
},
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'rejected', 'completed', 'cancelled'], 
    default: 'pending',
    lowercase: true
  },
  acceptedAt: { type: Date },
  completedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  notes: { type: String },
  isActive: { type: Boolean, default: true }
});
// Add indexes for better query performance
tradeSchema.index({ sellerFrom: 1, status: 1 });
tradeSchema.index({ sellerTo: 1, status: 1 });
tradeSchema.index({ createdAt: -1 });
// Add a method to check if trade can be accepted
tradeSchema.methods.canBeAccepted = function() {
  return this.status === 'pending';
};
const tradeModel = mongoose.models.Trade || mongoose.model('Trade', tradeSchema);
export default tradeModel;