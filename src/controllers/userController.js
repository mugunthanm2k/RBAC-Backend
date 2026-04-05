import bcrypt from 'bcryptjs';
import { body } from 'express-validator';
import pool from '../config/db.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const createUserValidation = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password min 8 chars')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password needs uppercase, lowercase & number'),
  body('role').isIn(['admin', 'manager', 'user']).withMessage('Invalid role'),
];

export const updateUserValidation = [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 chars'),
  body('email').optional().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('role').optional().isIn(['admin', 'manager', 'user']).withMessage('Invalid role'),
  body('is_active').optional().isBoolean().withMessage('is_active must be boolean'),
];

// GET /api/users - Admin + Manager
export const getAllUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : '%';
    const roleFilter = req.query.role || null;

    let query = `SELECT u.id, u.name, u.email, u.is_active, u.created_at, r.name as role
                 FROM users u JOIN roles r ON u.role_id = r.id
                 WHERE (u.name LIKE ? OR u.email LIKE ?)`;
    let params = [search, search];

    if (roleFilter) {
      query += ` AND r.name = ?`;
      params.push(roleFilter);
    }

    // Managers can only see users
    if (req.user.role === 'manager') {
      query += ` AND r.name = 'user'`;
    }

    const countQuery = query.replace(
      'SELECT u.id, u.name, u.email, u.is_active, u.created_at, r.name as role',
      'SELECT COUNT(*) as total'
    );
    const [countRows] = await pool.query(countQuery, params);

    query += ` ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await pool.query(query, params);

    return sendSuccess(res, {
      users: rows,
      pagination: {
        page,
        limit,
        total: countRows[0].total,
        totalPages: Math.ceil(countRows[0].total / limit),
      },
    });
  } catch (err) {
    console.error(err);
    return sendError(res, 'Failed to fetch users', 500);
  }
};

// GET /api/users/:id
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    if (isNaN(id)) return sendError(res, 'Invalid user ID', 400);

    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.is_active, u.created_at, u.updated_at, r.name as role
       FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`,
      [id]
    );

    if (!rows.length) return sendError(res, 'User not found', 404);

    // Managers can't view admins/other managers
    if (req.user.role === 'manager' && rows[0].role !== 'user') {
      return sendError(res, 'Access denied', 403);
    }

    return sendSuccess(res, rows[0]);
  } catch (err) {
    return sendError(res, 'Failed to fetch user', 500);
  }
};

// POST /api/users - Admin only
export const createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return sendError(res, 'Email already exists', 409);

    const [roleRows] = await pool.query('SELECT id FROM roles WHERE name = ?', [role]);
    if (!roleRows.length) return sendError(res, 'Role not found', 400);

    const hashed = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      `INSERT INTO users (name, email, password, role_id) VALUES (?, ?, ?, ?)`,
      [name, email, hashed, roleRows[0].id]
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)`,
      [req.user.id, 'CREATE_USER', `Created user: ${email} with role: ${role}`, req.ip]
    );

    return sendSuccess(res, { id: result.insertId, name, email, role }, 'User created successfully', 201);
  } catch (err) {
    return sendError(res, 'Failed to create user', 500);
  }
};

// PUT /api/users/:id - Admin only
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (isNaN(id)) return sendError(res, 'Invalid user ID', 400);

    const { name, email, role, is_active } = req.body;

    const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (!userRows.length) return sendError(res, 'User not found', 404);

    // Prevent self-deactivation
    if (parseInt(id) === req.user.id && is_active === false) {
      return sendError(res, 'Cannot deactivate your own account', 400);
    }

    let updates = [];
    let params = [];

    if (name) { updates.push('name = ?'); params.push(name); }
    if (email) {
      const [emailCheck] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
      if (emailCheck.length) return sendError(res, 'Email already in use', 409);
      updates.push('email = ?'); params.push(email);
    }
    if (role) {
      const [roleRows] = await pool.query('SELECT id FROM roles WHERE name = ?', [role]);
      if (!roleRows.length) return sendError(res, 'Invalid role', 400);
      updates.push('role_id = ?'); params.push(roleRows[0].id);
    }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }

    if (!updates.length) return sendError(res, 'No fields to update', 400);

    params.push(id);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)`,
      [req.user.id, 'UPDATE_USER', `Updated user ID: ${id}`, req.ip]
    );

    return sendSuccess(res, {}, 'User updated successfully');
  } catch (err) {
    return sendError(res, 'Failed to update user', 500);
  }
};

// DELETE /api/users/:id - Admin only
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (isNaN(id)) return sendError(res, 'Invalid user ID', 400);

    if (parseInt(id) === req.user.id) {
      return sendError(res, 'Cannot delete your own account', 400);
    }

    const [rows] = await pool.query('SELECT id, email FROM users WHERE id = ?', [id]);
    if (!rows.length) return sendError(res, 'User not found', 404);

    await pool.query('DELETE FROM users WHERE id = ?', [id]);

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)`,
      [req.user.id, 'DELETE_USER', `Deleted user: ${rows[0].email}`, req.ip]
    );

    return sendSuccess(res, {}, 'User deleted successfully');
  } catch (err) {
    return sendError(res, 'Failed to delete user', 500);
  }
};

// GET /api/users/stats - Admin
export const getUserStats = async (req, res) => {
  try {
    const [roleStats] = await pool.query(
      `SELECT r.name as role, COUNT(u.id) as count
       FROM roles r LEFT JOIN users u ON r.id = u.role_id
       GROUP BY r.id, r.name`
    );
    const [activeStats] = await pool.query(
      `SELECT
        SUM(is_active = 1) as active,
        SUM(is_active = 0) as inactive,
        COUNT(*) as total
       FROM users`
    );
    const [recentUsers] = await pool.query(
      `SELECT u.id, u.name, u.email, u.created_at, r.name as role
       FROM users u JOIN roles r ON u.role_id = r.id
       ORDER BY u.created_at DESC LIMIT 5`
    );
    return sendSuccess(res, { roleStats, activeStats: activeStats[0], recentUsers });
  } catch (err) {
    return sendError(res, 'Failed to fetch stats', 500);
  }
};

// GET /api/users/audit-logs - Admin
export const getAuditLogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const [logs] = await pool.query(
      `SELECT al.*, u.name as user_name, u.email as user_email
       FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [count] = await pool.query('SELECT COUNT(*) as total FROM audit_logs');

    return sendSuccess(res, {
      logs,
      pagination: { page, limit, total: count[0].total, totalPages: Math.ceil(count[0].total / limit) },
    });
  } catch (err) {
    return sendError(res, 'Failed to fetch audit logs', 500);
  }
};
