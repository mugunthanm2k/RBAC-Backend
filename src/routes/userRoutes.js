import express from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUserStats,
  getAuditLogs,
  createUserValidation,
  updateUserValidation,
} from '../controllers/userController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Admin-only routes
router.get('/stats', authorize('admin'), getUserStats);
router.get('/audit-logs', authorize('admin'), getAuditLogs);
router.post('/', authorize('admin'), createUserValidation, validate, createUser);
router.put('/:id', authorize('admin'), updateUserValidation, validate, updateUser);
router.delete('/:id', authorize('admin'), deleteUser);

// Admin + Manager routes
router.get('/', authorize('admin', 'manager'), getAllUsers);
router.get('/:id', authorize('admin', 'manager'), getUserById);

export default router;
