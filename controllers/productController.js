import { v2 as cloudinary } from "cloudinary";
import productModel from "../models/productModel.js";
import userModel from "../models/userModel.js";

import { handleProductDelete } from "./tradeController.js";
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const addProduct = async (req, res) => {
  try {
    const user = await userModel.findById(req.user._id);
    if (!user || user.role !== "seller") {
      return res
        .status(403)
        .json({ success: false, message: "Only sellers can add products" });
    }

    const {
      name,
      description,
      price,
      unitOfMeasurement,
      category,
      stock,
      freshness,
    } = req.body;

    const images = [];

    // Validate unitOfMeasurement enum
    const validUnits = ["kg", "g", "pc", "bundle", "pack", "lbs", "oz"];
    if (!validUnits.includes(unitOfMeasurement)) {
      return res.status(400).json({
        success: false,
        message: `Invalid unit. Must be one of: ${validUnits.join(", ")}`,
      });
    }

    // Validate category
    const validCategories = [
      "Vegetables",
      "Fruits",
      "Grains",
      "Root Crops",
      "Herbs",
      "Others",
    ];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: ${validCategories.join(
          ", "
        )}`,
      });
    }

    // Image upload logic remains the same
    if (req.files.image1) {
      const result = await cloudinary.uploader.upload(req.files.image1[0].path);
      images.push(result.secure_url);
    }
    // ... other image uploads remain the same

    const newProduct = new productModel({
      name,
      description,
      price,
      unitOfMeasurement,
      category,
      stock,
      freshness: freshness || "Fresh",
      images,
      sellerId: req.user._id,
    });

    await newProduct.save();
    res.status(201).json({
      success: true,
      message: "Product Added",
      product: newProduct,
    });
  } catch (error) {
    console.log("Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
export const deleteProduct = async (req, res) => {
  try {
    const productId = req.params.productId;
    const sellerId = req.user._id;

    // Verify product ownership
    const product = await productModel.findOne({ _id: productId, sellerId });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found or not owned by you",
      });
    }
    // Handle trade cancellations before deleting product
    const cancelledTradesCount = await handleProductDelete(productId);
    
    // Now delete the product
    await productModel.findByIdAndDelete(productId);

    return res.status(200).json({
      success: true,
      message: `Product deleted successfully. ${cancelledTradesCount} related trades were cancelled.`,
    });
  } catch (error) {
    console.log(error);
  }
};
export const listProducts = async (req, res) => {
  try {
    const {
      sort = "-createdAt",
      category,
      minPrice,
      maxPrice,
      freshness,
    } = req.query;

    const filter = { 
      isActive: true,
      stock: { $gt: 0 },
    };

    if (category) {
      filter.category = category;
    }

    if (freshness) {
      filter.freshness = freshness;
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    const productsFound = await productModel
      .find(filter)
      .populate("sellerId", "name")
      .sort(sort);

    const products = productsFound.map((product) => ({
      ...product.toObject(),
      seller: product.sellerId?.name || "Unknown Seller",
    }));

    res.json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// Function to remove a product
export const removeProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // Call handleProductDelete before removing the product
    const cancelledTradesCount = await handleProductDelete(id);

    const product = await productModel.findByIdAndDelete(id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    res.json({
      success: true,
      message: `Product removed successfully. ${cancelledTradesCount} related trades were cancelled.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Function to get a single product
export const singleProduct = async (req, res) => {
  try {
    // Access product ID from req.params
    const { productId } = req.params;
    const product = await productModel.findById(productId);
    res.json({ success: true, product });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      unitOfMeasurement,
      category,
      stock,
      freshness,
      availableForTrade,
    } = req.body;

    const existingProduct = await productModel.findOne({
      _id: id,
      sellerId: req.user._id,
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found or unauthorized",
      });
    }

    const updateData = {};

    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (price !== undefined) {
      if (price < 0) {
        return res.status(400).json({
          success: false,
          message: "Price cannot be negative",
        });
      }
      updateData.price = price;
    }
    if (unitOfMeasurement) {
      const validUnits = ["kg", "g", "pc", "bundle", "pack", "lbs", "oz"];
      if (!validUnits.includes(unitOfMeasurement)) {
        return res.status(400).json({
          success: false,
          message: `Invalid unit. Must be one of: ${validUnits.join(", ")}`,
        });
      }
      updateData.unitOfMeasurement = unitOfMeasurement;
    }
    if (category) {
      const validCategories = [
        "Vegetables",
        "Fruits",
        "Grains",
        "Root Crops",
        "Herbs",
        "Others",
      ];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          message: `Invalid category. Must be one of: ${validCategories.join(
            ", "
          )}`,
        });
      }
      updateData.category = category;
    }
    if (freshness) {
      const validFreshness = ["Fresh", "Day-old", "Stored", "Processed"];
      if (!validFreshness.includes(freshness)) {
        return res.status(400).json({
          success: false,
          message: `Invalid freshness. Must be one of: ${validFreshness.join(
            ", "
          )}`,
        });
      }
      updateData.freshness = freshness;
    }
    if (stock !== undefined) {
      if (stock < 0) {
        return res.status(400).json({
          success: false,
          message: "Stock cannot be negative",
        });
      }
      updateData.stock = stock;
      updateData.isActive = stock > 0;
    }
    if (availableForTrade !== undefined) {
      updateData.availableForTrade = availableForTrade;
    }

    const updatedProduct = await productModel.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    res.json({
      success: true,
      message: "Product Updated Successfully",
      product: updatedProduct,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: Object.values(error.errors).map((err) => err.message),
      });
    }
    console.error("Error updating product:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update product",
      error: error.message,
    });
  }
};
export const getSellerProducts = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const products = await productModel.find({ sellerId });
    res.status(200).json({ success: true, products });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

export const soonToBeHarvestedProducts = async (req, res) => {
  try {
    const today = new Date();
    const soonToBeHarvested = await productModel.find({
      harvestDate: {
        $gte: today,
        $lte: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
      }, // Next 7 days
    });
    res.json({ success: true, products: soonToBeHarvested });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};
