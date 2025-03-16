// filepath: /c:/Users/ACER/Documents/JavaScript/agriculture/backend/config/multerConfig.js
import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname);
  if (ext !== '.pdf' && ext !== '.doc' && ext !== '.docx' && ext !== '.jpg' && ext !== '.png') {
    return cb(new Error('Only documents and images are allowed'), false);
  }
  cb(null, true);
};

const upload = multer({ storage, fileFilter });

export default upload;