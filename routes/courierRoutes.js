import express from 'express';
import { 
  getAllCouriers,
  createCourier,
  updateCourier,
  deleteCourier,
  assignCourierToOrder,
  trackShipment,
  getPendingShipments,
  getShippingRates,
} from '../controllers/courierController.js';
import { authUser, authAdmin, authBuyer } from '../middleware/authRoles.js';

const router = express.Router();

// Public routes
router.get('/rates', getShippingRates);

// Buyer routes
router.get('/track/:trackingNumber', authUser, trackShipment);

// Admin routes
router.get('/', authUser, authAdmin, getAllCouriers);
router.post('/', authUser, authAdmin, createCourier);
router.put('/:id', authUser, authAdmin, updateCourier);
router.delete('/:id', authUser, authAdmin, deleteCourier);
router.post('/assign/:orderId', authUser, authAdmin, assignCourierToOrder);
router.get('/pending-shipments', authUser, authAdmin, getPendingShipments);

export default router;