import Otp from '../models/otpModel.js';
import userModel from '../models/userModel.js';
import { generateOtp } from '../utils/generateOtp.js';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD
  }
});

export const sendOtp = async (req, res) => {
  const { email } = req.body;

  console.log("Received email:", email); // Debugging log

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  const otp = generateOtp();

  const mailOptions = {
    from: process.env.EMAIL,
    to: email,
    subject: 'Your OTP Code',
    text: `Your OTP code is ${otp}`
  };

  try {
    await transporter.sendMail(mailOptions);
    await Otp.create({ email, otp, createdAt: new Date() });
    res.json({ success: true, message: 'OTP sent to your email' });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ success: false, message: 'Error sending OTP' });
  }
};

const verifyOtpForRole = async (req, res, role) => {
  const { email, otp } = req.body;

  console.log("Verifying OTP for:", email, "with OTP:", otp); // Debugging log

  try {
    const otpRecord = await Otp.findOne({ email, otp });
    console.log("OTP Record found:", otpRecord); // Debugging log

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // Check if OTP is expired (assuming OTP is valid for 10 minutes)
    const otpAge = (new Date() - new Date(otpRecord.createdAt)) / 1000 / 60; // in minutes
    if (otpAge > 10) {
      return res.status(400).json({ success: false, message: 'OTP expired' });
    }
    // Find user by email
    const user = await userModel.findOne({email})

    if (!user) {
      // If user does not exist, proceed with registration
      await Otp.deleteOne({_id: otpRecord._id})
      return res.status(200).json({ success: true, message: 'OTP verified, proceed with registration' });
    }
    if (!user.role.includes(role)) {
      user.role.push(role);
    }
    await user.save();

    await Otp.deleteOne({ _id: otpRecord._id });

    res.json({ success: true, message: `OTP verified and user role updated to ${role}` });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ success: false, message: 'Error verifying OTP' });
  }
};

export const verifyOtpForUser = (req, res) => verifyOtpForRole(req, res, 'user');
export const verifyOtpForSeller = (req, res) => verifyOtpForRole(req, res, 'seller');
export const verifyOtpForInvestor = (req, res) => verifyOtpForRole(req, res, 'investor');