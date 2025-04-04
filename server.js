import express from "express";
import cors from "cors";
import "dotenv/config";
import courierRoutes from './routes/courierRoutes.js';
import connectDB from "./config/mongodb.js";
import userRouter from "./routes/userRoute.js";
import productRouter from "./routes/productRoute.js";
import cartRouter from "./routes/cartRoute.js";
import orderRouter from "./routes/orderRoute.js";
import investmentRoutes from "./routes/investmentRoutes.js";
import sellerRouter from "./routes/sellerRoute.js";
import otpRouter from "./routes/otpRoute.js";
import tradeRoutes from "./routes/tradeRoutes.js";
import investorRouter from "./routes/investorRoute.js";
import campaignRouter from "./routes/campaignRoute.js";
import videoCampaignRouter from "./routes/videoCampaignRoute.js";
import documentRoutes from "./routes/documentRoutes.js";
import campaignQuestionRoutes from "./routes/campaignRoutes.js";
import notificationRoutes from './routes/notificationRoutes.js'
import campaignVideoRoutes from "./routes/videoCampaignRoute.js";
import adminRoutes from './routes/adminRoutes.js'
const app = express();
const port = process.env.PORT || 4000;
connectDB();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use(cors());
// app.use(cors({
//   origin: [
//     'http://localhost:3000',
//     'http://localhost:4000',
//     'http://localhost:5173',
//     // 'https://e-farm-frontend.vercel.app'  // Your production frontend on Vercel
//   ],
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
//   credentials: true,
//   preflightContinue: false,
//   optionsSuccessStatus: 204
// }));

app.use('/api/admin', adminRoutes)
app.use('/api/courier', courierRoutes);
app.use('/api/notification', notificationRoutes)
// API Endpoints
app.use("/api/campaign-videos", videoCampaignRouter);
app.use("/api/investor", investorRouter);
app.use("/api/user", userRouter);
app.use("/api/product", productRouter);
app.use("/api/cart", cartRouter);
app.use("/api/order", orderRouter);
app.use("/api/investments", investmentRoutes);
app.use("/api/seller", sellerRouter);
app.use("/api/otp", otpRouter);
app.use("/api/trades", tradeRoutes);
app.use("/api/documents", documentRoutes);
app.get("/", (req, res) => {
  res.send("API WORKING");
});
app.use("/api/campaign", campaignRouter);
app.use("/api/campaign-questions", campaignQuestionRoutes);
app.use("/api/campaign-videos", campaignVideoRoutes);
app.timeout = 600000;

app.listen(port, () => console.log("Server started on PORT: ", port));