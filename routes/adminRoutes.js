import express from 'express';
import { adminLogin } from '../controllers/userController.js'; 
import { authAdmin } from '../middleware/authRoles.js';

const router = express.Router();

// Public admin routes
router.post('/login', adminLogin);

// Protected admin routes (require authentication)
router.get('/dashboard', authAdmin, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Admin dashboard access granted',
    admin: {
      name: req.user.name || 'System Administrator',
      role: req.user.role
    }
  });
});

export default router;