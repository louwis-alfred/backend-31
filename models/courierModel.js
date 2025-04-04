import mongoose from 'mongoose';

const courierSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  contactEmail: { 
    type: String, 
    required: true 
  },
  contactPhone: { 
    type: String, 
    required: true 
  },
  serviceAreas: [{ 
    type: String 
  }],
  shippingRates: [{
    fromRegion: String,
    toRegion: String,
    basePrice: Number,
    pricePerKg: Number,
    estimatedDays: {
      min: Number,
      max: Number
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export default mongoose.model('Courier', courierSchema);