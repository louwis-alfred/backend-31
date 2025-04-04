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
  },
  shipping: {
    courier: { type: mongoose.Schema.Types.ObjectId, ref: 'Courier' },
    shipments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Shipment' }],
    totalCost: { type: Number, default: 0 },
    estimatedDelivery: Date,
    // New fields added as recommended
    status: { 
      type: String, 
      enum: ['Not Shipped', 'Partially Shipped', 'Completely Shipped'],
      default: 'Not Shipped'
    },
    method: { 
      type: String, 
      enum: ['Standard', 'Express', 'Same Day'],
      default: 'Standard'
    },
    tracking: {
      numbers: [String],  // For quick access to all tracking numbers
      url: String         // URL template to tracking page
    },
    // Additional helpful fields
    instructions: { type: String }, // Special delivery instructions
    isContactless: { type: Boolean, default: false }, // Contactless delivery option
    insuranceAmount: { type: Number, default: 0 }, // Shipping insurance amount
    needsRefrigeration: { type: Boolean, default: false } // For perishable agricultural products
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

// Add middleware to update shipping status when shipments are added or modified
orderSchema.pre('save', async function(next) {
  if (this.isModified('shipping.shipments')) {
    if (!this.shipping.shipments || this.shipping.shipments.length === 0) {
      this.shipping.status = 'Not Shipped';
    } else {
      // Check if all items have been assigned to shipments
      // This would require looking up the shipments, which might be complex in a pre-save hook
      // For simplicity, we'll just set it to 'Partially Shipped' if there's at least one shipment
      this.shipping.status = 'Partially Shipped';
      
      // If you implement the logic to check if all items are shipped, you can set:
      // this.shipping.status = 'Completely Shipped';
    }
    
    // Collect tracking numbers from shipments (if they were populated)
    if (this.populated('shipping.shipments')) {
      this.shipping.tracking = {
        numbers: this.shipping.shipments.map(shipment => shipment.trackingNumber).filter(Boolean),
        url: this.shipping.courier?.trackingUrlTemplate || ''
      };
    }
  }
  next();
});

// Helper method to check if order is fully shipped
orderSchema.methods.isFullyShipped = async function() {
  if (!this.shipping || !this.shipping.shipments || this.shipping.shipments.length === 0) {
    return false;
  }
  
  // This would require populating shipments and checking if all order items are included
  // For now we'll return a simple implementation
  return this.shipping.status === 'Completely Shipped';
};

// Helper method to get shipping ETA
orderSchema.methods.getShippingETA = function() {
  if (!this.shipping || !this.shipping.estimatedDelivery) {
    return null;
  }
  return this.shipping.estimatedDelivery;
};

// Generate tracking URL with the correct tracking number
orderSchema.methods.getTrackingUrl = function(trackingNumber) {
  if (!this.shipping || !this.shipping.tracking || !this.shipping.tracking.url) {
    return null;
  }
  
  // Replace placeholder with actual tracking number
  return this.shipping.tracking.url.replace('{trackingNumber}', trackingNumber);
};

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
  }
});

const orderModel = mongoose.models.Order || mongoose.model('Order', orderSchema);

// Export the schema for reuse in other models
export { orderItemSchema };

// Export the model as default
export default orderModel;