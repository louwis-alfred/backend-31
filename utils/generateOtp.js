import crypto from 'crypto';

export const generateOtp = () => { 
    return crypto.randomBytes(3).toString('hex');
}