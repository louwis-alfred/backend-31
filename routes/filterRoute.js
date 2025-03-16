import express from 'express';
import { authUser } from '../middleware/authRoles.js';
import { getFilteredOrders, getOrdersByStatus } from '../controllers/filterController.js';

const filterRouter = express.Router();

// Get orders with filter options
filterRouter.get('/orders', authUser, getFilteredOrders);

// Get orders by specific status
filterRouter.get('/orders/status/:status', authUser, getOrdersByStatus);

export default filterRouter;