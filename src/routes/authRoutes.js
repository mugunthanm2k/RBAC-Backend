import express from 'express';
import { body } from 'express-validator';
import {
  login,
  register,
  getMe,
  changePassword,
  loginValidation,
  registerValidation,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

router.post('/login', loginValidation, validate, login);
router.post('/register', registerValidation, validate, register);
router.get('/me', authenticate, getMe);
router.put(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password min 8 chars')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Need uppercase, lowercase & number'),
  ],
  validate,
  changePassword
);

export default router;
