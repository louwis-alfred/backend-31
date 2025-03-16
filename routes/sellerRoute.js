import express from 'express';
import { getSellerDashboardData } from '../controllers/getSellerDashboardData.js';
import { authUser } from '../middleware/authRoles.js';

const sellerRouter = express.Router();

sellerRouter.get('/dashboard', authUser, getSellerDashboardData);

export default sellerRouter;