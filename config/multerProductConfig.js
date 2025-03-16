import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  destination: './uploads/products/', // Specify the directory for product images
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png' && ext !== '.gif') {
    return cb(new Error('Only images are allowed'), false);
  }
  cb(null, true);
};

const uploadProductImages = multer({ storage, fileFilter });

export default uploadProductImages;