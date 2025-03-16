import multer from "multer";
import path from "path";
import fs from "fs";

// Create uploads directory if it doesn't exist
const uploadDir = "uploads/videos";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for campaign video uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/videos");
  },
  filename: function (req, file, cb) {
    cb(null, `campaign-video-${Date.now()}${path.extname(file.originalname)}`);
  },
});

// File filter to accept video and image files
const fileFilter = (req, file, cb) => {
  if (file.fieldname === "video") {
    // Accept video files
    if (
      file.mimetype === "video/mp4" ||
      file.mimetype === "video/mov" ||
      file.mimetype === "video/avi" ||
      file.mimetype === "video/webm"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed for this field!"), false);
    }
  } else if (file.fieldname === "thumbnail") {
    // Accept image files for thumbnails
    if (
      file.mimetype === "image/png" ||
      file.mimetype === "image/jpg" ||
      file.mimetype === "image/jpeg"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed for thumbnails!"), false);
    }
  } else {
    cb(new Error("Unexpected field name"), false);
  }
};

// Create multer upload object with INCREASED size limits
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB max file size for videos
  }
});

export default upload;