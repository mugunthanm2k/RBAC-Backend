import bcrypt from 'bcryptjs';
import { body } from 'express-validator';
import pool from '../config/db.js';
import { generateToken } from '../utils/jwt.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

export const registerValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase and number'),
  body('role')
    .optional()
    .isIn(['admin', 'manager', 'user'])
    .withMessage('Role must be admin, manager, or user'),
];

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.password, u.is_active, r.name as role
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.email = ?`,
      [email]
    );

    if (!rows.length) {
      return sendError(res, 'Invalid email or password', 401);
    }

    const user = rows[0];

    if (!user.is_active) {
      return sendError(res, 'Account is deactivated. Contact administrator.', 403);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendError(res, 'Invalid email or password', 401);
    }

    const token = generateToken({ id: user.id, role: user.role });

    // Log audit
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)`,
      [user.id, 'LOGIN', 'User logged in successfully', req.ip]
    );

    return sendSuccess(res, {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    }, 'Login successful');
  } catch (err) {
    console.error('Login error:', err);
    return sendError(res, 'Login failed. Please try again.', 500);
  }
};

export const register = async (req, res) => {
  try {
    const { name, email, password, role = 'user' } = req.body;

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return sendError(res, 'Email is already registered', 409);
    }

    const [roleRows] = await pool.query('SELECT id FROM roles WHERE name = ?', [role]);
    if (!roleRows.length) {
      return sendError(res, 'Invalid role specified', 400);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const [result] = await pool.query(
      `INSERT INTO users (name, email, password, role_id) VALUES (?, ?, ?, ?)`,
      [name, email, hashedPassword, roleRows[0].id]
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)`,
      [result.insertId, 'REGISTER', 'New user registered', req.ip]
    );

    return sendSuccess(res, { id: result.insertId, name, email, role }, 'Registration successful', 201);
  } catch (err) {
    console.error('Register error:', err);
    return sendError(res, 'Registration failed. Please try again.', 500);
  }
};

export const getMe = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.is_active, u.created_at, r.name as role
       FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`,
      [req.user.id]
    );
    if (!rows.length) return sendError(res, 'User not found', 404);
    return sendSuccess(res, rows[0]);
  } catch (err) {
    return sendError(res, 'Failed to fetch profile', 500);
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length) return sendError(res, 'User not found', 404);

    const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
    if (!isMatch) return sendError(res, 'Current password is incorrect', 400);

    const hashed = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)`,
      [req.user.id, 'CHANGE_PASSWORD', 'Password changed successfully', req.ip]
    );

    return sendSuccess(res, {}, 'Password changed successfully');
  } catch (err) {
    return sendError(res, 'Failed to change password', 500);
  }
};
