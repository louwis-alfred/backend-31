import express from 'express';
import { sendOtp, verifyOtpForUser, verifyOtpForSeller, verifyOtpForInvestor } from '../controllers/otpController.js';

const otpRouter = express.Router();

otpRouter.post('/send', sendOtp);
otpRouter.post('/verify/user', verifyOtpForUser);
otpRouter.post('/verify/seller', verifyOtpForSeller);
otpRouter.post('/verify/investor', verifyOtpForInvestor);

export default otpRouter;