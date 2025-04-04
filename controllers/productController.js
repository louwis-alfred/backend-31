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
// Get a specific product by ID
export const getProductById = async (req, res) => {
  try {
    const productId = req.params.id;
    
    // Find the product by ID
    const product = await Product.findById(productId)
      .populate('sellerId', 'name businessName') // Populate seller information
      .lean();
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch product details',
      error: error.message
    });
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
    console.log("🔍 Update Product Request");
    console.log("Headers:", req.headers);
    console.log("Params:", req.params);
    console.log("Body:", req.body);
    console.log("Files:", req.files);
    
    // Verify Cloudinary is configured
    console.log("📂 Cloudinary config:", cloudinary.config().cloud_name ? "Valid" : "Invalid");
    
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
      imagesToDelete,
    } = req.body;

    // Verify user and product
    console.log(`🔍 Finding product with ID: ${id} and sellerId: ${req.user._id}`);
    const existingProduct = await productModel.findOne({
      _id: id,
      sellerId: req.user._id,
    });

    if (!existingProduct) {
      console.log("❌ Product not found or unauthorized");
      return res.status(404).json({
        success: false,
        message: "Product not found or unauthorized",
      });
    }

    console.log("✅ Product found:", existingProduct);
    const updateData = {};

    // Basic field updates with type conversion
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    
    if (price !== undefined) {
      const numPrice = Number(price);
      if (isNaN(numPrice)) {
        return res.status(400).json({
          success: false,
          message: "Price must be a number",
        });
      }
      if (numPrice < 0) {
        return res.status(400).json({
          success: false,
          message: "Price cannot be negative",
        });
      }
      updateData.price = numPrice;
    }
    
    if (unitOfMeasurement !== undefined) {
      const validUnits = ["kg", "g", "pc", "bundle", "pack", "lbs", "oz"];
      if (!validUnits.includes(unitOfMeasurement)) {
        return res.status(400).json({
          success: false,
          message: `Invalid unit. Must be one of: ${validUnits.join(", ")}`,
        });
      }
      updateData.unitOfMeasurement = unitOfMeasurement;
    }
    
    if (category !== undefined) {
      const validCategories = [
        "Vegetables", "Fruits", "Grains", "Root Crops", 
        "Herbs", "Others", "Meat", "SeaFood",
      ];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          message: `Invalid category. Must be one of: ${validCategories.join(", ")}`,
        });
      }
      updateData.category = category;
    }
    
    if (freshness !== undefined) {
      const validFreshness = ["Fresh", "Day-old", "Stored", "Processed"];
      if (!validFreshness.includes(freshness)) {
        return res.status(400).json({
          success: false,
          message: `Invalid freshness. Must be one of: ${validFreshness.join(", ")}`,
        });
      }
      updateData.freshness = freshness;
    }
    
    if (stock !== undefined) {
      const numStock = Number(stock);
      if (isNaN(numStock)) {
        return res.status(400).json({
          success: false,
          message: "Stock must be a number",
        });
      }
      if (numStock < 0) {
        return res.status(400).json({
          success: false,
          message: "Stock cannot be negative",
        });
      }
      updateData.stock = numStock;
      updateData.isActive = numStock > 0;
    }
    
    if (availableForTrade !== undefined) {
      // Convert string "true"/"false" to boolean if needed
      if (typeof availableForTrade === "string") {
        updateData.availableForTrade = availableForTrade.toLowerCase() === "true";
      } else {
        updateData.availableForTrade = Boolean(availableForTrade);
      }
    }

    // Handle image updates
    console.log("🖼️ Processing image updates");
    console.log("Current images:", existingProduct.images);
    let currentImages = [...existingProduct.images]; // Start with existing images

    // Handle image deletion
    let hasImageChanges = false;
    if (imagesToDelete) {
      console.log("📤 Requested images to delete:", imagesToDelete);
      // Convert to array if it's not already
      const imagesToRemove = Array.isArray(imagesToDelete) 
        ? imagesToDelete 
        : typeof imagesToDelete === 'string' 
          ? [imagesToDelete]
          : [];
      
      if (imagesToRemove.length > 0) {
        console.log("📤 Processing image deletion:", imagesToRemove);
        const originalCount = currentImages.length;
        currentImages = currentImages.filter(img => !imagesToRemove.includes(img));
        
        if (originalCount !== currentImages.length) {
          hasImageChanges = true;
        }
        console.log("📤 Images after deletion:", currentImages);
      }
    }
    
    // Handle image uploads with position tracking
    const newImages = {};
    if (req.files && Object.keys(req.files).length > 0) {
      console.log("📥 Processing new image uploads:", Object.keys(req.files));
      
      for (const fileKey in req.files) {
        if (!req.files[fileKey] || !req.files[fileKey][0]) {
          console.log(`⚠️ No file found for key: ${fileKey}`);
          continue;
        }
        
        // Extract position index from fileKey (e.g., "image1" -> position 0)
        const match = fileKey.match(/image(\d+)/);
        if (!match || !match[1]) {
          console.log(`⚠️ Invalid file key format: ${fileKey}`);
          continue;
        }
        
        const position = parseInt(match[1]) - 1; // Convert to 0-based index
        console.log(`📥 Image ${fileKey} will be placed at position ${position}`);
        
        try {
          console.log(`📥 Uploading image: ${fileKey} - ${req.files[fileKey][0].originalname}`);
          const result = await cloudinary.uploader.upload(req.files[fileKey][0].path, {
            folder: "agricultural_products",
            resource_type: "image"
          });
          
          console.log(`✅ Upload successful: ${result.secure_url}`);
          newImages[position] = result.secure_url;
          hasImageChanges = true;
          
          // Clean up the temp file
          const fs = await import('fs');
          try {
            fs.unlinkSync(req.files[fileKey][0].path);
            console.log(`🗑️ Deleted temp file: ${req.files[fileKey][0].path}`);
          } catch (unlinkError) {
            console.error(`⚠️ Could not delete temp file: ${unlinkError.message}`);
          }
        } catch (uploadError) {
          console.error(`❌ Error uploading ${fileKey}:`, uploadError);
        }
      }
      
      console.log(`📥 Added ${Object.keys(newImages).length} new images`);
    } else {
      console.log("ℹ️ No new images uploaded");
    }
    
    // Update the images array only if we have changes
    if (hasImageChanges) {
      // Create a sparse array representing current positions and uploaded positions
      const finalImages = [...currentImages]; // Start with existing images that weren't deleted
      
      // Add new images at their specified positions
      for (const [posStr, imageUrl] of Object.entries(newImages)) {
        const pos = parseInt(posStr);
        console.log(`📦 Placing new image at position ${pos}: ${imageUrl}`);
        
        // If position is beyond current array length, may need to extend the array
        while (pos >= finalImages.length) {
          finalImages.push(null);
        }
        
        finalImages[pos] = imageUrl;
      }
      
      // Remove any null values (empty slots) from the array
      const updatedImages = finalImages.filter(img => img !== null);
      
      // Ensure there's at least one image
      if (updatedImages.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Product must have at least one image"
        });
      }
      
      updateData.images = updatedImages;
      console.log("🖼️ Final images array:", updateData.images);
    }

    // Check if there are any fields to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update"
      });
    }

    // Debug information
    console.log("📝 Final update data:", JSON.stringify(updateData, null, 2));

    // Perform the update
    console.log(`🔄 Updating product with ID: ${id}`);
    const updatedProduct = await productModel.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true, // Return the updated document
        runValidators: true, // Run model validators
      }
    );

    if (!updatedProduct) {
      console.log("❌ Product not found after update attempt");
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    console.log("✅ Product updated successfully");
    res.json({
      success: true,
      message: "Product Updated Successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("❌ Error updating product:", error);
    
    // Handle specific error types
    if (error.name === "ValidationError") {
      console.log("❌ Validation error:", error.errors);
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: Object.values(error.errors).map((err) => err.message),
      });
    }
    
    if (error.name === "CastError") {
      console.log("❌ Cast error - invalid ID format");
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }
    
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
