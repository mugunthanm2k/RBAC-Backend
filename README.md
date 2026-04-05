# RBAC System — React + Vite + Node.js + MySQL

A complete Role-Based Access Control system with JWT authentication.

## 🏗️ Project Structure

```
rbac-app/
├── backend/          # Node.js + Express API
│   ├── src/
│   │   ├── config/   # DB connection & init
│   │   ├── controllers/
│   │   ├── middleware/  # auth, validate, errorHandler
│   │   ├── routes/
│   │   └── utils/
│   └── package.json
└── frontend/         # React + Vite + Tailwind v4
    ├── src/
    │   ├── api/       # Axios instance
    │   ├── components/ # Layout, ProtectedRoute, UI
    │   ├── context/   # AuthContext
    │   ├── pages/
    │   │   ├── admin/
    │   │   ├── manager/
    │   │   ├── user/
    │   │   └── shared/
    └── package.json
```

## ⚡ Quick Setup

### 1. MySQL Database

```sql
CREATE DATABASE rbac_db ;
```

Tables are **auto-created** on first server start. A default admin is also seeded automatically.

### 2. Backend

```bash
cd backend
npm install
cp .env
# Edit .env with your MySQL credentials
npm run dev
```

Server runs on: `http://localhost:5000`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs on: `http://localhost:5173`

---

## 🔐 Default Credentials

| Role    | Email              | Password     |
|---------|--------------------|--------------|
| Admin   | admin@rbac.com     | Admin@123    |

> Create Manager/User accounts via Register page or Admin panel.

---

## 👥 Roles & Permissions

| Feature              | Admin | Manager | User |
|----------------------|:-----:|:-------:|:----:|
| View own dashboard   | ✅   | ✅      | ✅  |
| Change own password  | ✅   | ✅      | ✅  |
| View team (users)    | ✅   | ✅      | ❌  |
| Create users         | ✅   | ❌      | ❌  |
| Edit/delete users    | ✅   | ❌      | ❌  |
| View audit logs      | ✅   | ❌      | ❌  |
| View user stats      | ✅   | ❌      | ❌  |

---

## 🛠️ API Endpoints

### Auth
| Method | Endpoint                  | Access |
|--------|---------------------------|--------|
| POST   | /api/auth/login           | Public |
| POST   | /api/auth/register        | Public |
| GET    | /api/auth/me              | Auth   |
| PUT    | /api/auth/change-password | Auth   |

### Users
| Method | Endpoint              | Access         |
|--------|-----------------------|----------------|
| GET    | /api/users            | Admin, Manager |
| GET    | /api/users/stats      | Admin          |
| GET    | /api/users/audit-logs | Admin          |
| GET    | /api/users/:id        | Admin, Manager |
| POST   | /api/users            | Admin          |
| PUT    | /api/users/:id        | Admin          |
| DELETE | /api/users/:id        | Admin          |

---

## 🛡️ Security Features

- JWT tokens with expiry (7 days default)
- bcrypt password hashing (cost factor 12)
- Rate limiting (100 req/15min global, 10 req/15min on login)
- Input validation with express-validator
- Role-based route protection (frontend + backend)
- Audit logging for all sensitive operations
- User active/inactive status check on every request
- Protected Routes with auto-redirect based on role
- CORS restricted to dev/prod origins

## 🎨 Frontend Routes

```
/login            → Login page (public)
/register         → Register page (public)
/admin            → Admin Dashboard
/admin/users      → User Management (CRUD)
/admin/audit-logs → Audit Logs
/admin/profile    → Profile
/manager          → Manager Dashboard
/manager/users    → Team Members (view-only)
/manager/profile  → Profile
/dashboard        → User Dashboard
/dashboard/profile→ Profile
/unauthorized     → 403 page
```
