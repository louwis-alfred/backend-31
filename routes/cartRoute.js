import express from 'express'
import { addToCart, getUserCart, updateCart } from '../controllers/cartController.js'
import { authUser } from '../middleware/authRoles.js'
import jwt from 'jsonwebtoken'
import userModel from '../models/userModel.js'

const cartRouter = express.Router()

// Soft auth middleware for cart
const cartAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Continue without setting req.user
      return next();
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded && decoded.id) {
      const user = await userModel.findById(decoded.id);
      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    // If token verification fails, just continue
    next();
  }
};

// Use soft auth for GET cart
cartRouter.get('/get', cartAuth, getUserCart)

// Keep full auth for modifying cart
cartRouter.post('/add', authUser, addToCart)
cartRouter.put('/update', authUser, updateCart)

export default cartRouter