import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";

const authUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log("Authorization header missing or does not start with 'Bearer '");
    return res.status(401).json({ success: false, message: 'Not Authorized. Please log in.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const token_decode = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if the token has an ID before attempting to find the user
    if (!token_decode || !token_decode.id) {
      console.log("Invalid token format - missing ID");
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token format. Please log in again.' 
      });
    }
    
    const user = await userModel.findById(token_decode.id);
    
    // Check if user was found
    if (!user) {
      console.log("User not found with ID:", token_decode.id);
      return res.status(401).json({ 
        success: false, 
        message: 'User not found. Please log in again.' 
      });
    }
    
    // Set user on the request
    req.user = user; 
    next();
  } catch (error) {
    console.log("Error verifying token:", error.message);
    res.status(401).json({ success: false, message: 'Invalid Token. Please log in again.' });
  }
};


// Soft authentication middleware that never returns errors
const softAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // If no auth header or doesn't start with Bearer, just continue
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log("No auth header or invalid format");
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    // Decode the token
    const token_decode = jwt.verify(token, process.env.JWT_SECRET);
    
    // Ensure token_decode.id exists
    if (!token_decode || !token_decode.id) {
      console.log("Token decoded but no ID found");
      return next();
    }
    
    // Find user in DB
    const user = await userModel.findById(token_decode.id);
    
    // Set req.user if user exists
    if (user) {
      req.user = token_decode; // Just set the decoded token info with the ID
    }
  } catch (error) {
    // If token verification fails, just log and continue
    console.log("Token verification failed:", error.message);
  }
  
  // Always continue to next middleware
  next();
};

// Middleware to check if the user is a seller
const authSeller = (req, res, next) => {
  if (!req.user.role.includes('seller')) {
    return res.status(403).json({ success: false, message: 'Access denied. Not a seller.' });
  }
  next();
};

// Middleware to check if the user is an investor
const authInvestor = async (req, res, next) => {
    try {
        const user = await userModel.findById(req.user._id); // Use req.user._id

        if (!user || !user.role.includes("investor")) {
            return res.status(403).json({ success: false, message: "Access Denied. Investor role required." });
        }

        next();
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

export { authUser, authSeller, authInvestor, softAuth };