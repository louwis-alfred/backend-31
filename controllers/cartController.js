import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js";

// add to user cart
const addToCart = async (req, res) => {
  try {
    // Check if user exists first
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    const userId = req.user._id;
    const { itemId } = req.body;

    const userData = await userModel.findById(userId);
    if (!userData) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const product = await productModel.findById(itemId); // Fetch product details
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    let cartData = userData.cartData || {}; // Initialize cartData if it's null/undefined

    if (cartData[itemId]) {
      // Check if there is enough stock to add one more item
      if (product.stock < cartData[itemId].quantity + 1) {
        return res
          .status(400)
          .json({ success: false, message: `Not enough stock for product: ${product.name}` });
      }
      cartData[itemId].quantity += 1; // Increment quantity
    } else {
      // Check if there is enough stock to add the item
      if (product.stock < 1) {
        return res
          .status(400)
          .json({ success: false, message: `Not enough stock for product: ${product.name}` });
      }
      cartData[itemId] = {
        quantity: 1,
        name: product.name, // Store product name
        price: product.price, // Store product price
        image: product.images && product.images.length ? product.images[0] : ""
      };
    }

    // Decrement the product stock
    product.stock -= 1;
    await product.save(); // Save the updated product stock

    userData.cartData = cartData; // Update cartData
    await userData.save(); // Save the updated user document

    res.json({ success: true, message: "Added To Cart" });
  } catch (error) {
    console.error(error); // Use console.error for errors
    res.status(500).json({ success: false, message: error.message }); // Send 500 for server errors
  }
};

const updateCart = async (req, res) => {
  try {
    // Check if user exists first
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }
    
    console.log("Received request to update cart:", req.body);
    const userId = req.user._id; // Get userId from req.user
    const { itemId, quantity } = req.body;

    const userData = await userModel.findById(userId);
    if (!userData) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const product = await productModel.findById(itemId); // Fetch product details
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    let cartData = userData.cartData || {}; // Initialize cartData if it's null/undefined

    if (!cartData[itemId]) {
      return res
        .status(404)
        .json({ success: false, message: "Item not in cart" });
    }

    const oldQuantity = cartData[itemId].quantity; // Get the old quantity
    const quantityDifference = quantity - oldQuantity; // Calculate the difference

    console.log("Old quantity:", oldQuantity);
    console.log("New quantity:", quantity);
    console.log("Quantity difference:", quantityDifference);

    // Check if there is enough stock to update the quantity
    if (product.stock < quantityDifference) {
      return res
        .status(400)
        .json({ success: false, message: `Not enough stock for product: ${product.name}` });
    }

    // Update the product stock
    product.stock -= quantityDifference;
    console.log("Updated product stock:", product.stock);
    await product.save(); // Save the updated product stock

    cartData[itemId].quantity = quantity; // Update quantity

    userData.cartData = cartData; // Update cartData
    await userData.save(); // Save the updated user document

    res.json({ success: true, message: "Cart Updated" });
  } catch (error) {
    console.error("Error updating cart:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// get user cart data
const getUserCart = async (req, res) => {
  try {
    // Check if user exists first
    if (!req.user) {
      return res.json({ 
        success: true, 
        cartData: {},
        message: "Not authenticated" 
      });
    }
    
    const userId = req.user._id;
    
    const userData = await userModel.findById(userId);
    if (!userData) {
      return res.json({ 
        success: true, 
        cartData: {},
        message: "User not found" 
      });
    }

    let cartData = userData.cartData || {};

    // Fetch all product details in a single query
    const productIds = Object.keys(cartData);
    const products = await productModel.find({
      _id: { $in: productIds },
      isActive: true, // Add isActive here
    });

    // Create a map of product ID to product
    const productMap = new Map(
      products.map((product) => [product._id.toString(), product])
    );

    // Update cart items with the latest product information
    for (const itemId in cartData) {
      if (cartData.hasOwnProperty(itemId)) {
        const product = productMap.get(itemId);
        if (product) {
          cartData[itemId].name = product.name;
          cartData[itemId].price = product.price;
          cartData[itemId].image = product.images && product.images.length ? product.images[0] : "";
        } else {
          // Product not found, remove it from the cart
          delete cartData[itemId];
        }
      }
    }

    // Save the updated cart data to the user document
    userData.cartData = cartData;
    await userData.save();

    res.json({ success: true, cartData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export { addToCart, updateCart, getUserCart };