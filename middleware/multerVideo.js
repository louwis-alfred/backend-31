import multer from "multer";
import path from "path";
import fs from "fs";

// Make sure the uploads directory exists
const uploadDir = "uploads/videos/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// Add a more permissive file filter
const fileFilter = function(req, file, cb) {
  const allowedTypes = ['video/mp4', 'video/webm', 'video/mov', 'video/avi', 'video/quicktime'];
  
  // Accept all video types for debugging
  if (file.fieldname === 'video' || allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only MP4, WebM, MOV, and AVI videos are allowed."), false);
  }
};

// Create a specialized multer instance for videos with increased limits
const uploadVideo = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max file size - increase from 200MB
  }
});

export default uploadVideo;