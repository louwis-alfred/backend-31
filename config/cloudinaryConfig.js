import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

// Configure Cloudinary with enhanced settings for video uploads
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Configure global upload settings
cloudinary.config({
  chunk_size: 6000000, // 6MB chunks for better upload reliability
  timeout: 120000 // 2 minute timeout
});

export default cloudinary;