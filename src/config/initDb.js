import pool from './db.js';

const initializeDatabase = async () => {
  const queries = [
    `CREATE TABLE IF NOT EXISTS roles (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name ENUM('admin', 'manager', 'user') NOT NULL UNIQUE,
      description VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role_id INT NOT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
    )`,

    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT,
      action VARCHAR(100) NOT NULL,
      details TEXT,
      ip_address VARCHAR(45),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )`,

    `INSERT IGNORE INTO roles (name, description) VALUES
      ('admin', 'Full system access - manage users and settings'),
      ('manager', 'Manage team members and view reports'),
      ('user', 'Standard access to personal dashboard')`,
  ];

  for (const query of queries) {
    await pool.query(query);
  }

  // Seed default admin if not exists
  const [admins] = await pool.query(
    `SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'admin' LIMIT 1`
  );

  if (admins.length === 0) {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.default.hash('Admin@123', 12);
    const [roleRow] = await pool.query(`SELECT id FROM roles WHERE name = 'admin'`);
    await pool.query(
      `INSERT INTO users (name, email, password, role_id) VALUES (?, ?, ?, ?)`,
      ['Super Admin', 'admin@rbac.com', hash, roleRow[0].id]
    );
    console.log('🌱 Default admin seeded: admin@rbac.com / Admin@123');
  }

  console.log('✅ Database initialized');
};

export default initializeDatabase;
