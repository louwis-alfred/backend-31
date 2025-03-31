import Trade from "../models/tradeModel.js";
import productModel from "../models/productModel.js";
import userModel from "../models/userModel.js";
// Constants for trade statuses - use these throughout the controller
const TRADE_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
};
export const getReceivedTradedProducts = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find products that came from trades
    const tradedProducts = await productModel
      .find({
        sellerId: userId,
        "origin.tradeId": { $exists: true }, // Products with origin from trade
      })
      .populate({
        path: "origin.originalSellerId",
        select: "name email location",
        model: "User",
      })
      .sort({ "origin.acquiredDate": -1 });

    return res.status(200).json({
      success: true,
      products: tradedProducts,
    });
  } catch (error) {
    console.error("Error fetching traded products:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching traded products",
      error: error.message,
    });
  }
};

// Get trade history for a product
export const getProductTradeHistory = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId)
      .populate({
        path: "tradeHistory.tradedFrom",
        select: "name email",
      })
      .populate({
        path: "tradeHistory.tradedTo",
        select: "name email",
      })
      .populate({
        path: "tradeHistory.newOwner",
        select: "name email",
      });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if user is owner or has been involved in trades with this product
    const userId = req.user._id;
    const isOwner = product.sellerId.toString() === userId.toString();
    const isInvolved = product.tradeHistory.some(
      (entry) =>
        (entry.tradedFrom &&
          entry.tradedFrom._id.toString() === userId.toString()) ||
        (entry.tradedTo &&
          entry.tradedTo._id.toString() === userId.toString()) ||
        (entry.newOwner && entry.newOwner._id.toString() === userId.toString())
    );

    if (!isOwner && !isInvolved) {
      return res.status(403).json({
        success: false,
        message:
          "You don't have permission to view this product's trade history",
      });
    }

    return res.status(200).json({
      success: true,
      tradeHistory: product.tradeHistory,
    });
  } catch (error) {
    console.error("Error fetching product trade history:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching trade history",
      error: error.message,
    });
  }
};

export const getTrade = async (req, res) => {
  try {
    const { tradeId } = req.params;
    const trade = await Trade.findById(tradeId);

    if (!trade) {
      return res.status(404).json({
        success: false,
        message: "Trade not found",
      });
    }

    res.status(200).json({
      success: true,
      trade,
    });
  } catch (error) {
    console.error("Error fetching trade:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching trade",
      error: error.message,
    });
  }
};

// Initiate a trade with flexible stock specification
export const initiateTrade = async (req, res) => {
  try {
    const {
      sellerTo,
      productIdFrom,
      productIdTo,
      quantityFrom, // The amount of seller's own product to offer
      quantityTo, // The amount of recipient's product requested (optional)
    } = req.body;
    const sellerFrom = req.user._id;

    // 1. Validate required fields
    if (!sellerTo || !productIdFrom || !productIdTo || !quantityFrom) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields (seller, products, and offer quantity are required)",
      });
    }

    // 2. Validate self-trade attempt
    if (sellerFrom.toString() === sellerTo.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot trade with yourself",
      });
    }

    // 3. Get the product being offered (productFrom)
    const productFrom = await productModel.findOne({
      _id: productIdFrom,
      sellerId: sellerFrom,
    });

    if (!productFrom) {
      return res.status(404).json({
        success: false,
        message: "Your product not found or not owned by you",
      });
    }

    // 4. Check if product is available for trade
    if (!productFrom.availableForTrade) {
      return res.status(400).json({
        success: false,
        message: "Your product is not available for trade",
      });
    }

    // 5. Get the product being requested (productTo)
    const productTo = await productModel.findOne({
      _id: productIdTo,
      sellerId: sellerTo,
    });

    if (!productTo) {
      return res.status(404).json({
        success: false,
        message: "Recipient's product not found or not owned by them",
      });
    }

    // Check if recipient's product is available for trade
    if (!productTo.availableForTrade) {
      return res.status(400).json({
        success: false,
        message: "Recipient's product is not available for trade",
      });
    }

    // 6. Validate recipient seller
    const sellerToUser = await userModel.findById(sellerTo);
    if (!sellerToUser || sellerToUser.role !== "seller") {
      return res.status(404).json({
        success: false,
        message: "Recipient seller not found or not a valid seller",
      });
    }

    // 7. Validate quantities
    // Validate your offered quantity
    if (quantityFrom <= 0 || quantityFrom > productFrom.stock) {
      return res.status(400).json({
        success: false,
        message: `Invalid quantity for your offer. You have ${productFrom.stock} available.`,
      });
    }

    // Set default quantityTo if not provided (1:1 trade by default)
    const finalQuantityTo = quantityTo || quantityFrom;

    // Validate requested quantity (if specified, it shouldn't exceed recipient's stock)
    if (finalQuantityTo <= 0 || finalQuantityTo > productTo.stock) {
      return res.status(400).json({
        success: false,
        message: `Invalid quantity requested. Recipient has ${productTo.stock} available.`,
      });
    }

    // 8. Calculate approximate trade value to show fairness
    const offeredValue = productFrom.price * quantityFrom;
    const requestedValue = productTo.price * finalQuantityTo;
    const valueDifference = Math.abs(offeredValue - requestedValue);
    const valueRatio = (offeredValue / requestedValue).toFixed(2);

    // 9. Create and save the trade
    const newTrade = new Trade({
      sellerFrom,
      sellerTo,
      productFrom: productIdFrom,
      productTo: productIdTo,
      quantityFrom, // New: Quantity of seller's product
      quantityTo: finalQuantityTo, // New: Quantity of recipient's product
      quantity: quantityFrom, // For backward compatibility with existing code
      status: TRADE_STATUS.PENDING,
      // Save trade value information for later reference
      tradeDetails: {
        offeredValue,
        requestedValue,
        valueRatio,
      },
    });

    await newTrade.save();

    // 10. Return with detailed product information
    const tradeWithDetails = await Trade.findById(newTrade._id)
      .populate({
        path: "productFrom",
        select:
          "name description price images category stock unitOfMeasurement freshness",
      })
      .populate({
        path: "productTo",
        select:
          "name description price images category stock unitOfMeasurement freshness",
      })
      .populate({
        path: "sellerFrom",
        select: "name email location",
        model: "User", // Add this to fix the model reference
      })
      .populate({
        path: "sellerTo",
        select: "name email location",
        model: "User", // Add this to fix the model reference
      });

    res.status(201).json({
      success: true,
      message: "Trade initiated",
      trade: tradeWithDetails,
      fairnessMetrics: {
        offeredValue,
        requestedValue,
        valueDifference,
        valueRatio,
      },
    });
  } catch (error) {
    console.error("Error initiating trade:", error);
    res.status(500).json({
      success: false,
      message: "Server error while initiating trade",
      error: error.message,
    });
  }
};

// Accept a trade
export const acceptTrade = async (req, res) => {
  try {
    const { tradeId } = req.body;
    const sellerTo = req.user._id;

    const trade = await Trade.findOne({ _id: tradeId, sellerTo })
      .populate("productFrom")
      .populate("productTo");

    if (!trade) {
      return res.status(404).json({
        success: false,
        message: "Trade not found or not authorized",
      });
    }

    if (trade.status !== TRADE_STATUS.PENDING) {
      return res.status(400).json({
        success: false,
        message: `Trade cannot be accepted as it is already ${trade.status}`,
      });
    }

    // Check stock availability for both products
    if (trade.productFrom.stock < trade.quantity) {
      return res.status(400).json({
        success: false,
        message: "Not enough stock in offered product",
      });
    }

    // Update trade status
    trade.status = TRADE_STATUS.ACCEPTED;
    trade.acceptedAt = new Date();
    await trade.save();

    // Return success response immediately to the frontend
    res.json({
      success: true,
      message: "Trade accepted successfully",
      trade,
    });

    // Note: Removed setTimeout in favor of manual completion via completeTrade endpoint
  } catch (error) {
    console.error("Error accepting trade:", error);
    res.status(500).json({
      success: false,
      message: "Server error while accepting trade",
      error: error.message,
    });
  }
};

// Reject a trade
export const rejectTrade = async (req, res) => {
  try {
    const { tradeId } = req.body;
    const sellerTo = req.user._id;

    // Find the trade
    const trade = await Trade.findOne({ _id: tradeId, sellerTo });
    if (!trade) {
      return res.status(404).json({
        success: false,
        message: "Trade not found or not authorized",
      });
    }

    if (trade.status !== TRADE_STATUS.PENDING) {
      return res.status(400).json({
        success: false,
        message: `Trade cannot be rejected as it is already ${trade.status}`,
      });
    }

    // Update the trade status (using lowercase to match constants)
    trade.status = TRADE_STATUS.REJECTED;
    await trade.save();

    res.json({
      success: true,
      message: "Trade rejected successfully",
      trade,
    });
  } catch (error) {
    console.error("Error rejecting trade:", error);
    res.status(500).json({
      success: false,
      message: "Server error while rejecting trade",
      error: error.message,
    });
  }
};

// Cancel a trade

export const cancelTrade = async (req, res) => {
  try {
    const { tradeId } = req.body;
    const sellerFrom = req.user._id;

    // Find the trade (changed 'Pending' to 'pending' for case consistency)
    const trade = await Trade.findOne({
      _id: tradeId,
      sellerFrom,
      status: TRADE_STATUS.PENDING,
    });

    if (!trade) {
      return res.status(404).json({
        success: false,
        message:
          "Trade not found, not authorized, or cannot be cancelled in its current state",
      });
    }

    // Update the trade status (using lowercase to match constants)
    trade.status = TRADE_STATUS.CANCELLED;
    await trade.save();

    res.json({
      success: true,
      message: "Trade cancelled successfully",
      trade,
    });
  } catch (error) {
    console.error("Error cancelling trade:", error);
    res.status(500).json({
      success: false,
      message: "Server error while cancelling trade",
      error: error.message,
    });
  }
};

export const getCompletedTrades = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find completed trades where the current user is either sellerFrom or sellerTo
    const completedTrades = await Trade.find({
      $or: [{ sellerFrom: userId }, { sellerTo: userId }],
      status: "completed",
    })
      .populate({
        path: "productFrom",
        select: "name description price images category unitOfMeasurement",
      })
      .populate({
        path: "productTo",
        select: "name description price images category unitOfMeasurement",
      })
      .populate({
        path: "sellerFrom",
        select: "name email location",
        model: "User",
      })
      .populate({
        path: "sellerTo",
        select: "name email location",
        model: "User",
      })
      .sort({ completedAt: -1 });

    // Format the trades for better frontend display
    const formattedTrades = completedTrades.map((trade) => {
      const isSellerFrom =
        trade.sellerFrom._id.toString() === userId.toString();

      // Determine which product the user gave and which they received
      const productGiven = isSellerFrom ? trade.productFrom : trade.productTo;
      const productReceived = isSellerFrom
        ? trade.productTo
        : trade.productFrom;
      const quantityGiven = isSellerFrom
        ? trade.quantityFrom || trade.quantity
        : trade.quantityTo || trade.quantity;
      const quantityReceived = isSellerFrom
        ? trade.quantityTo || trade.quantity
        : trade.quantityFrom || trade.quantity;

      return {
        _id: trade._id,
        completedAt: trade.completedAt,
        withUser: isSellerFrom ? trade.sellerTo : trade.sellerFrom,
        given: {
          product: productGiven,
          quantity: quantityGiven,
        },
        received: {
          product: productReceived,
          quantity: quantityReceived,
        },
        notes: trade.notes,
        tradeDetails: trade.tradeDetails,
        shipping: trade.shipping || {}, // Include shipping information
      };
    });

    return res.status(200).json({
      success: true,
      completedTrades: formattedTrades,
    });
  } catch (error) {
    console.error("Error fetching completed trades:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching completed trades",
      error: error.message,
    });
  }
};

export const completeTrade = async (req, res) => {
  try {
    const { tradeId } = req.body;
    const userId = req.user._id;

    // Find the trade with populated product data
    const trade = await Trade.findById(tradeId)
      .populate("productFrom")
      .populate("productTo")
      .populate({
        path: "sellerFrom",
        select: "name email",
        model: "User",
      })
      .populate({
        path: "sellerTo",
        select: "name email",
        model: "User",
      });

    if (!trade) {
      return res.status(404).json({
        success: false,
        message: "Trade not found",
      });
    }

    // Handle both populated and non-populated seller documents properly
    const sellerFromId = trade.sellerFrom._id
      ? trade.sellerFrom._id.toString()
      : trade.sellerFrom.toString();
    const sellerToId = trade.sellerTo._id
      ? trade.sellerTo._id.toString()
      : trade.sellerTo.toString();
    const userIdStr = userId.toString();

    // Both parties can confirm completion (either sender or recipient)
    if (sellerFromId !== userIdStr && sellerToId !== userIdStr) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to complete this trade",
      });
    }

    // Check if trade is in accepted status
    if (trade.status !== TRADE_STATUS.ACCEPTED) {
      return res.status(400).json({
        success: false,
        message: `Only accepted trades can be completed. Current status: ${trade.status}`,
      });
    }

    // Update trade status
    trade.status = TRADE_STATUS.COMPLETED;
    trade.completedAt = new Date();

    // Create detailed transaction log before updating stock
    const transactionLog = {
      productFromBefore: {
        _id: trade.productFrom._id,
        name: trade.productFrom.name,
        stock: trade.productFrom.stock,
      },
      productToBefore: {
        _id: trade.productTo._id,
        name: trade.productTo.name,
        stock: trade.productTo.stock,
      },
      // Use the appropriate quantity fields - this adds support for flexible quantities
      quantityFrom: trade.quantityFrom || trade.quantity,
      quantityTo: trade.quantityTo || trade.quantity,
      // Keep legacy field for backward compatibility
      quantityTraded: trade.quantity,
    };

    // Get the correct quantities to deduct from each product
    const quantityFromDeduction = trade.quantityFrom || trade.quantity;
    const quantityToDeduction = trade.quantityTo || trade.quantity;

    // Add trade history to both products - MOVED HERE after quantities are defined
    if (trade.productFrom) {
      trade.productFrom.tradeHistory = trade.productFrom.tradeHistory || [];
      trade.productFrom.tradeHistory.push({
        tradeId: trade._id,
        tradedTo: trade.sellerTo,
        tradedFrom: trade.sellerFrom,
        date: new Date(),
        quantity: quantityFromDeduction,
        newOwner: trade.sellerTo,
      });
      await trade.productFrom.save();
    }

    if (trade.productTo) {
      trade.productTo.tradeHistory = trade.productTo.tradeHistory || [];
      trade.productTo.tradeHistory.push({
        tradeId: trade._id,
        tradedTo: trade.sellerFrom,
        tradedFrom: trade.sellerTo,
        date: new Date(),
        quantity: quantityToDeduction,
        newOwner: trade.sellerFrom,
      });
      await trade.productTo.save();
    }

    // Update productFrom stock
    if (trade.productFrom) {
      if (trade.productFrom.stock < quantityFromDeduction) {
        return res.status(400).json({
          success: false,
          message: `Not enough stock in product "${trade.productFrom.name}" (${trade.productFrom.stock} available, ${quantityFromDeduction} needed)`,
        });
      }

      trade.productFrom.stock -= quantityFromDeduction;

      // If stock is 0, also update availableForTrade
      if (trade.productFrom.stock === 0) {
        trade.productFrom.availableForTrade = false;
      }

      await trade.productFrom.save();
    }

    // Update productTo stock
    if (trade.productTo) {
      if (trade.productTo.stock < quantityToDeduction) {
        return res.status(400).json({
          success: false,
          message: `Not enough stock in requested product "${trade.productTo.name}" (${trade.productTo.stock} available, ${quantityToDeduction} needed)`,
        });
      }

      trade.productTo.stock -= quantityToDeduction;

      // If stock is 0, also update availableForTrade
      if (trade.productTo.stock === 0) {
        trade.productTo.availableForTrade = false;
      }

      await trade.productTo.save();
    }

    // Create a new product entry for each party based on the trade
    const tradeFromUserToSeller =
      trade.sellerFrom._id.toString() === userId.toString();

    // Create new product for recipient based on trade.productFrom
    const receivedProduct = new productModel({
      name: trade.productFrom.name,
      description: trade.productFrom.description,
      price: trade.productFrom.price,
      images: trade.productFrom.images,
      category: trade.productFrom.category,
      freshness: trade.productFrom.freshness,
      unitOfMeasurement: trade.productFrom.unitOfMeasurement,
      stock: quantityFromDeduction, // The quantity they received
      availableForTrade: false, // Default to not available for trade
      sellerId: tradeFromUserToSeller
        ? trade.sellerTo._id
        : trade.sellerFrom._id,
      origin: {
        tradeId: trade._id,
        originalProductId: trade.productFrom._id,
        originalSellerId: trade.sellerFrom._id,
        acquiredDate: new Date(),
      },
    });

    await receivedProduct.save();

    // Also create a new product for the other party based on trade.productTo
    const recipientProduct = new productModel({
      name: trade.productTo.name,
      description: trade.productTo.description,
      price: trade.productTo.price,
      images: trade.productTo.images,
      category: trade.productTo.category,
      freshness: trade.productTo.freshness,
      unitOfMeasurement: trade.productTo.unitOfMeasurement,
      stock: quantityToDeduction, // The quantity they received
      availableForTrade: false,
      sellerId: tradeFromUserToSeller
        ? trade.sellerFrom._id
        : trade.sellerTo._id,
      origin: {
        tradeId: trade._id,
        originalProductId: trade.productTo._id,
        originalSellerId: trade.sellerTo._id,
        acquiredDate: new Date(),
      },
    });

    await recipientProduct.save();

    // Complete the transaction log
    transactionLog.productFromAfter = {
      stock: trade.productFrom.stock,
    };
    transactionLog.productToAfter = {
      stock: trade.productTo.stock,
    };

    // Store transaction log in trade notes
    const existingNotes = trade.notes ? `${trade.notes}\n\n` : "";
    trade.notes = existingNotes + JSON.stringify(transactionLog);
    await trade.save();

    // Return detailed response with product info
    return res.status(200).json({
      success: true,
      message: "Trade completed successfully",
      trade: {
        ...trade.toObject(),
        productFromDetails: {
          name: trade.productFrom.name,
          stockRemaining: trade.productFrom.stock,
          quantityTraded: quantityFromDeduction,
        },
        productToDetails: {
          name: trade.productTo.name,
          stockRemaining: trade.productTo.stock,
          quantityTraded: quantityToDeduction,
        },
      },
    });
  } catch (error) {
    console.error("Error completing trade:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while completing trade",
      error: error.message,
    });
  }
};

// Get all trades for the current user
export const getTrades = async (req, res) => {
  try {
    const sellerId = req.user._id;

    const trades = await Trade.find({
      $or: [{ sellerFrom: sellerId }, { sellerTo: sellerId }],
    })
      .populate(
        "productFrom",
        "name description price images category stock freshness unitOfMeasurement"
      )
      .populate(
        "productTo",
        "name description price images category stock freshness unitOfMeasurement"
      )
      .populate({
        path: "sellerFrom",
        select: "name email location sellerDocument",
        model: "User", // Explicitly specify the model with proper case
      })
      .populate({
        path: "sellerTo",
        select: "name email location sellerDocument",
        model: "User", // Explicitly specify the model with proper case
      })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      trades,
    });
  } catch (error) {
    console.error("Error fetching trades:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching trades",
      error: error.message,
    });
  }
};

// Release product manually (maintaining for backward compatibility)
export const releaseProduct = async (req, res) => {
  try {
    const { tradeId } = req.body;
    const sellerFrom = req.user._id;

    // Find the trade
    const trade = await Trade.findOne({ _id: tradeId, sellerFrom });
    if (!trade) {
      return res.status(404).json({
        success: false,
        message: "Trade not found or not authorized",
      });
    }

    if (trade.status !== TRADE_STATUS.ACCEPTED) {
      return res.status(400).json({
        success: false,
        message: "Only accepted trades can be released",
      });
    }

    // Update the trade status to completed and mark as released
    trade.status = TRADE_STATUS.COMPLETED;
    trade.released = true;
    trade.completedAt = new Date();
    await trade.save();

    res.json({
      success: true,
      message: "Product released successfully",
      trade,
    });
  } catch (error) {
    console.error("Error releasing product:", error);
    res.status(500).json({
      success: false,
      message: "Server error while releasing product",
      error: error.message,
    });
  }
};

// Get products available for trade
export const getProductsForTrade = async (req, res) => {
  try {
    // Get available products for trade
    const products = await productModel
      .find({
        availableForTrade: true,
        stock: { $gt: 0 },
        isActive: true,
      })
      .populate({
        path: "sellerId",
        select: "name email location",
        model: "User",
      });

    // Track products missing seller references
    const productsWithoutSeller = [];

    // Format products with seller info, handling null sellerId values
    const formattedProducts = products.map((product) => {
      // Base product object with _doc spread to get all fields
      const formattedProduct = {
        ...product._doc,
      };

      // Only add seller info if sellerId exists and is populated
      if (product.sellerId) {
        formattedProduct.seller = {
          _id: product.sellerId._id,
          name: product.sellerId.name,
          email: product.sellerId.email,
          location: product.sellerId.location || "",
        };
      } else {
        // Provide default seller info for products with missing seller
        formattedProduct.seller = {
          _id: null,
          name: "Unknown Seller",
          email: "N/A",
          location: "N/A",
        };

        // Track products with missing seller references
        productsWithoutSeller.push({
          _id: product._id,
          name: product.name,
        });
      }

      return formattedProduct;
    });

    // Log a summary instead of individual warnings for each product
    if (productsWithoutSeller.length > 0) {
      console.warn(
        `${productsWithoutSeller.length} products found with missing seller references:`
      );
      console.warn(
        `Product IDs: ${productsWithoutSeller.map((p) => p._id).join(", ")}`
      );
    }

    // Filter out any products that might cause issues in the frontend
    const validProducts = formattedProducts.filter(
      (product) =>
        // Ensure required product fields exist
        product._id && product.name && product.price >= 0
    );

    res.json({
      success: true,
      products: validProducts,
      total: validProducts.length,
    });
  } catch (error) {
    console.error("Error in getProductsForTrade:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching available trade products",
      error: error.message,
    });
  }
};

// Get current user's products available for trade
export const getCurrentUserTradeProducts = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    const products = await productModel
      .find({
        sellerId: currentUserId,
        availableForTrade: true,
        stock: { $gt: 0 },
        isActive: true,
      })
      .populate({
        path: "sellerId",
        select: "name email location",
        model: "User",
      });

    res.json({
      success: true,
      products: products,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user's trade products",
      error: error.message,
    });
  }
};

// Add a product to the trade marketplace
export const addProductForTrade = async (req, res) => {
  try {
    const { productId } = req.body;
    const sellerId = req.user._id;

    const product = await productModel.findOne({ _id: productId, sellerId });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found or not owned by seller",
      });
    }

    // Mark the product as available for trade
    product.availableForTrade = true;
    await product.save();

    res.json({
      success: true,
      message: "Product added for trade successfully",
      product,
    });
  } catch (error) {
    console.error("Error adding product for trade:", error);
    res.status(500).json({
      success: false,
      message: "Server error while adding product for trade",
      error: error.message,
    });
  }
};

// Get available trade products for a specific user
export const getAvailableTradeProducts = async (req, res) => {
  try {
    const userId = req.params.userId;

    const products = await productModel.find({
      sellerId: userId,
      availableForTrade: true,
      stock: { $gt: 0 },
      isActive: true,
    });

    res.json({
      success: true,
      products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching available trade products",
      error: error.message,
    });
  }
};

// Get available trades for a specific seller
export const getAvailableTradesForSeller = async (req, res) => {
  try {
    const { userId } = req.params;

    const products = await productModel
      .find({
        sellerId: userId,
        availableForTrade: true,
        stock: { $gt: 0 },
        isActive: true,
      })
      .populate("seller");

    res.json({
      success: true,
      products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching available trades",
      error: error.message,
    });
  }
};

export const removeProductFromTrade = async (req, res) => {
  try {
    const { productId } = req.body;
    const sellerId = req.user._id;

    // Find the product and verify ownership
    const product = await productModel.findOne({ _id: productId, sellerId });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found or not owned by you",
      });
    }

    // Mark product as not available for trade
    product.availableForTrade = false;
    await product.save();

    // Find all pending trades involving this product and cancel them
    const pendingTrades = await Trade.find({
      $or: [
        { productFrom: productId, status: TRADE_STATUS.PENDING },
        { productTo: productId, status: TRADE_STATUS.PENDING },
      ],
    });

    // Update status of all pending trades to cancelled
    if (pendingTrades.length > 0) {
      await Trade.updateMany(
        {
          $or: [
            { productFrom: productId, status: TRADE_STATUS.PENDING },
            { productTo: productId, status: TRADE_STATUS.PENDING },
          ],
        },
        {
          $set: {
            status: TRADE_STATUS.CANCELLED,
            notes: `Trade automatically cancelled because the product was removed from trading by the seller.`,
          },
        }
      );
    }

    return res.status(200).json({
      success: true,
      message: `Product removed from trade and ${pendingTrades.length} pending trades cancelled`,
      cancelledTradesCount: pendingTrades.length,
    });
  } catch (error) {
    console.error("Error removing product from trade:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while removing product from trade",
      error: error.message,
    });
  }
};

// Hook to call when deleting a product (can be called from productController)
export const handleProductDelete = async (productId) => {
  try {
    // Find all pending or accepted trades involving this product
    const affectedTrades = await Trade.find({
      $or: [
        {
          productFrom: productId,
          status: { $in: [TRADE_STATUS.PENDING, TRADE_STATUS.ACCEPTED] },
        },
        {
          productTo: productId,
          status: { $in: [TRADE_STATUS.PENDING, TRADE_STATUS.ACCEPTED] },
        },
      ],
    });

    // Update status of all affected trades to cancelled
    if (affectedTrades.length > 0) {
      await Trade.updateMany(
        {
          $or: [
            {
              productFrom: productId,
              status: { $in: [TRADE_STATUS.PENDING, TRADE_STATUS.ACCEPTED] },
            },
            {
              productTo: productId,
              status: { $in: [TRADE_STATUS.PENDING, TRADE_STATUS.ACCEPTED] },
            },
          ],
        },
        {
          $set: {
            status: TRADE_STATUS.CANCELLED,
            notes: `Trade automatically cancelled because the product was deleted.`,
          },
        }
      );
    }

    console.log(
      `Product ${productId} deleted: ${affectedTrades.length} trades cancelled`
    );
    return affectedTrades.length;
  } catch (error) {
    console.error("Error handling product deletion:", error);
    return 0;
  }
};

export const getTradeDetails = async (req, res) => {
  try {
    const { tradeId } = req.params;
    const userId = req.user._id;

    const trade = await Trade.findById(tradeId)
      .populate(
        "productFrom",
        "name description price images category stock freshness unitOfMeasurement"
      )
      .populate(
        "productTo",
        "name description price images category stock freshness unitOfMeasurement"
      )
      .populate({
        path: "sellerFrom",
        select: "name email phone location supportingDocument",
        model: "User",
      })
      .populate({
        path: "sellerTo",
        select: "name email phone location supportingDocument",
        model: "User",
      });

    if (!trade) {
      return res.status(404).json({
        success: false,
        message: "Trade not found",
      });
    }

    // Verify user is part of this trade
    if (
      trade.sellerFrom.toString() !== userId.toString() &&
      trade.sellerTo.toString() !== userId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this trade",
      });
    }

    res.json({
      success: true,
      trade,
    });
  } catch (error) {
    console.error("Error fetching trade details:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching trade details",
      error: error.message,
    });
  }
};
// Update a pending trade
export const updateTrade = async (req, res) => {
  try {
    const { tradeId, quantityFrom, quantityTo } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!tradeId || (!quantityFrom && !quantityTo)) {
      return res.status(400).json({
        success: false,
        message: "Trade ID and at least one quantity value are required",
      });
    }

    // Find the trade
    const trade = await Trade.findOne({
      _id: tradeId,
      sellerFrom: userId,
      status: TRADE_STATUS.PENDING,
    })
      .populate("productFrom")
      .populate("productTo");

    if (!trade) {
      return res.status(404).json({
        success: false,
        message: "Trade not found, not owned by you, or not in pending status",
      });
    }

    // Validate new quantities
    if (
      quantityFrom &&
      (quantityFrom <= 0 || quantityFrom > trade.productFrom.stock)
    ) {
      return res.status(400).json({
        success: false,
        message: `Invalid quantity for your offer. You have ${trade.productFrom.stock} available.`,
      });
    }

    if (quantityTo && (quantityTo <= 0 || quantityTo > trade.productTo.stock)) {
      return res.status(400).json({
        success: false,
        message: `Invalid quantity requested. Recipient has ${trade.productTo.stock} available.`,
      });
    }

    // Update quantities if provided
    if (quantityFrom) {
      trade.quantityFrom = quantityFrom;
    }

    if (quantityTo) {
      trade.quantityTo = quantityTo;
    }

    // Recalculate trade value metrics
    const offeredValue = trade.productFrom.price * trade.quantityFrom;
    const requestedValue = trade.productTo.price * trade.quantityTo;
    const valueDifference = Math.abs(offeredValue - requestedValue);
    const valueRatio = (offeredValue / requestedValue).toFixed(2);

    trade.tradeDetails = {
      offeredValue,
      requestedValue,
      valueRatio,
    };

    // Add note about the update
    const updateNote = `Trade quantities updated on ${new Date().toISOString()}. New quantities - From: ${
      trade.quantityFrom
    }, To: ${trade.quantityTo}`;
    trade.notes = trade.notes ? `${trade.notes}\n${updateNote}` : updateNote;

    // For backward compatibility with older code that might depend on quantity field
    // This line is important to fix your error
    trade.quantity = trade.quantityFrom;

    await trade.save();

    // Return updated trade with populated details
    const updatedTrade = await Trade.findById(tradeId)
      .populate({
        path: "productFrom",
        select:
          "name description price images category stock unitOfMeasurement freshness",
      })
      .populate({
        path: "productTo",
        select:
          "name description price images category stock unitOfMeasurement freshness",
      })
      .populate({
        path: "sellerFrom",
        select: "name email location",
        model: "User",
      })
      .populate({
        path: "sellerTo",
        select: "name email location",
        model: "User",
      });

    res.json({
      success: true,
      message: "Trade updated successfully",
      trade: updatedTrade,
      fairnessMetrics: {
        offeredValue,
        requestedValue,
        valueDifference,
        valueRatio,
      },
    });
  } catch (error) {
    console.error("Error updating trade:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating trade",
      error: error.message,
    });
  }
};

export const uploadTradeFile = async (req, res) => {
  try {
    const { tradeId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const result = await cloudinary.uploader.upload(file.path, {
      folder: "trade-attachments",
      resource_type: "auto",
    });

    const attachment = new TradeAttachment({
      tradeId,
      messageId: req.body.messageId,
      type: req.body.type || "document",
      url: result.secure_url,
      name: file.originalname,
      size: file.size,
      uploadedBy: req.user._id,
    });

    await attachment.save();
    res.json({
      success: true,
      attachment,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
