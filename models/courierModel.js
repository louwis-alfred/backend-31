import mongoose from 'mongoose';

const courierSchema = new mongoose.Schema({
  name: { type: String, required: true },
  available: { type: Boolean, default: true },
  address: { type: String, required: true },
  plate_number: { type: String, required: true },
  driver_license: { type: String, required: true },
});

const Courier = mongoose.model('Courier', courierSchema, 'couriers');

export default Courier;