import express from "express";
import {
  listProducts,
  addProduct,
  singleProduct,
  removeProduct,
  updateProduct,
  getSellerProducts,
} from "../controllers/productController.js";
import { authUser, authSeller } from "../middleware/authRoles.js";
import uploadProductImages from "../config/multerProductConfig.js";

const productRouter = express.Router();

productRouter.get("/list", listProducts);
productRouter.post(
  "/add",
  authUser,
  authSeller,
  uploadProductImages.fields([
    { name: "image1", maxCount: 1 },
    { name: "image2", maxCount: 1 },
    { name: "image3", maxCount: 1 },
    { name: "image4", maxCount: 1 },
  ]),
  addProduct
);
productRouter.get("/:productId", authUser, singleProduct);
productRouter.delete("/remove/:id", authUser, authSeller, removeProduct);
productRouter.put("/update/:id", authUser, authSeller, updateProduct);
productRouter.get("/seller/:sellerId", authUser, authSeller, getSellerProducts);

export default productRouter;
