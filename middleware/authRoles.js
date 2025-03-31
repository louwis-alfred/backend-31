import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";
const softAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token, but that's okay - just continue without user
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded && decoded.id) {
      // Find user if token is valid
      const user = await userModel.findById(decoded.id);
      if (user) {
        // Add user to request if found
        req.user = user;
      }
    }
    
    // Continue regardless of whether we found a user
    next();
  } catch (error) {
    // Token error, but in softAuth we just continue without user
    console.log("Token verification failed in softAuth, continuing:", error.message);
    next();
  }
};
const authUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log("Authorization header missing or invalid format");
    return res.status(401).json({ 
      success: false, 
      message: 'Not Authorized. Please log in.' 
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded || !decoded.id) {
      console.log("Invalid token format - missing ID");
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token format. Please log in again.' 
      });
    }
    
    // Find user in the unified user model
    const user = await userModel.findById(decoded.id);
    
    if (!user) {
      console.log("User not found with ID:", decoded.id);
      return res.status(401).json({ 
        success: false, 
        message: 'User not found. Please log in again.' 
      });
    }
    
    // Add user to request
    req.user = user;
    next();
  } catch (error) {
    console.log("Error verifying token:", error);
    res.status(401).json({ 
      success: false, 
      message: 'Invalid Token. Please log in again.' 
    });
  }
};

// Middleware to check if the user is a seller
const authSeller = (req, res, next) => {
  if (req.user.role !== 'seller') {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Not a seller.' 
    });
  }
  next();
};

// Middleware to check if the user is an investor
const authInvestor = (req, res, next) => {
  if (req.user.role !== 'investor') {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Not an investor.' 
    });
  }
  next();
};

// Middleware to check if the user is a buyer
const authBuyer = (req, res, next) => {
  if (req.user.role !== 'buyer') {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Not a buyer.' 
    });
  }
  next();
};


export { authUser, authSeller, authInvestor, authBuyer, softAuth };