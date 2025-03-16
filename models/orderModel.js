import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: String, required: true }
});

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  items: {
    type: [orderItemSchema],
    required: true,
    validate: {
      validator: function(items) {
        return Array.isArray(items) && items.length > 0;
      },
      message: 'Order must contain at least one item'
    }
  },
  tracking: {
    history: [{
      status: { type: String },
      timestamp: { type: Date, default: Date.now },
      note: { type: String },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    estimatedDelivery: { type: Date },
    trackingNumber: { type: String }
  },
  
  sellerActions: [{
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, enum: ['confirmed', 'rejected', 'shipped', 'refunded'] },
    reason: { type: String },
    items: [{
      itemId: { type: mongoose.Schema.Types.ObjectId },
      name: String,
      quantity: Number
    }],
    timestamp: { type: Date, default: Date.now }
  }],
  
  refundInfo: {
    refundedAt: { type: Date },
    refundedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String },
    amount: { type: Number },
    items: [{
      productId: { type: mongoose.Schema.Types.ObjectId },
      name: { type: String },
      quantity: { type: Number }
    }]
  },
  // Add this to your existing orderModel schema
refundRequest: {
  requestedAt: { type: Date },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reason: { type: String },
  images: [{ type: String }], // Optional proof images
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  amount: { type: Number },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId },
    name: { type: String },
    quantity: { type: Number }
  }],
  message: { type: String },
  responseMessage: { type: String },
  respondedAt: { type: Date },
  respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
},
  amount: { type: Number, required: true },
  address: { type: Object, required: true },
  status: { 
    type: String, 
    default: 'Pending Confirmation', 
    enum: [
      'Pending Confirmation',  // Initial state, waiting for seller approval
      'Confirmed',             // Approved by seller
      'Rejected',              // Rejected by seller
      'Processing',            // Being prepared
      'Order Placed',          // Legacy status
      'Shipped',               // In transit
      'Delivered',             // Successfully delivered
      'Cancelled',             // Cancelled after confirmation
      'Returned',              // Customer returned item
      'Refunded'               // Money returned to customer
    ]
  },
  paymentMethod: { type: String, required: true },
  payment: { type: Boolean, default: false },
  date: { 
    type: Date, 
    required: true, 
    default: Date.now,
    // This getter ensures we always get a proper Date object
    get: function(value) {
      if (value instanceof Date) return value;
      return new Date(value);
    }
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt fields
  toJSON: { getters: true }, // Enable the date getter when converting to JSON
  toObject: { getters: true } // Enable the date getter when converting to object
});

// Add a virtual for formatted date
orderSchema.virtual('formattedDate').get(function() {
  return this.date ? new Date(this.date).toLocaleString() : 'Unknown date';
});

const orderHistorySchema = new mongoose.Schema({
  status: { 
    type: String,
    required: true,
    enum: [
      'Pending Confirmation',
      'Confirmed',
      'Rejected',
      'Processing',
      'Order Placed',
      'Shipped',
      'Delivered', 
      'Cancelled',
      'Returned',
      'Refunded'
    ]
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  note: String,
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  details: {
    previousStatus: String,
    newStatus: String,
    reason: String,
    location: String,
    courierInfo: {
      courierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Courier' },
      courierName: String,
      trackingNumber: String
    }
  }
});



const orderModel = mongoose.models.Order || mongoose.model('Order', orderSchema);

// Export the schema for reuse in other models
export { orderItemSchema };

// Export the model as default
export default orderModel;