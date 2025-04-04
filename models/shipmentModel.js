import mongoose from 'mongoose';

const locationUpdateSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['Picked Up', 'In Transit', 'Out for Delivery', 'Delivered', 'Failed Delivery', 'Returned'],
    required: true
  },
  location: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  notes: String,
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

const shipmentSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  courierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Courier',
    required: true
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  trackingNumber: {
    type: String,
    required: true,
    unique: true
  },
  packageDetails: {
    weight: Number, // in kg
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    },
    items: [{
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      },
      quantity: Number,
      name: String
    }]
  },
  pickupAddress: {
    street: String,
    city: String,
    state: String,
    zipcode: String,
    country: String,
    contactName: String,
    contactPhone: String
  },
  deliveryAddress: {
    street: String,
    city: String,
    state: String,
    zipcode: String,
    country: String,
    contactName: String,
    contactPhone: String
  },
  scheduledPickup: Date,
  estimatedDelivery: Date,
  shippingCost: Number,
  isPaid: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['Pending', 'Scheduled', 'Picked Up', 'In Transit', 'Out for Delivery', 'Delivered', 'Failed Delivery', 'Returned'],
    default: 'Pending'
  },
  locationHistory: [locationUpdateSchema],
  proofOfDelivery: {
    image: String,
    signature: String,
    receiverName: String,
    timestamp: Date
  },
  notes: String
}, {
  timestamps: true
});

// Generate tracking number pre-save
shipmentSchema.pre('save', async function(next) {
  if (this.isNew) {
    const prefix = 'AGF';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.trackingNumber = `${prefix}${timestamp}${random}`;
  }
  next();
});

export default mongoose.model('Shipment', shipmentSchema);