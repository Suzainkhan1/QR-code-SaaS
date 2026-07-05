# CrunchOS - Production Deployment Guide

This guide details the step-by-step instructions required to build, configure, deploy, and verify the CrunchOS Restaurant System on production platforms:
- **Frontend** ➡️ **Vercel**
- **Backend** ➡️ **Render**
- **Database** ➡️ **PostgreSQL**

---

## 1. Required Environment Variables

### Backend Configuration (Render)
Ensure these environment variables are set in the Render Dashboard under **Environment Settings**:

| Variable | Description | Example / Required Value |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@host:5432/db?sslmode=require` |
| `JWT_SECRET` | Secure 64-character signing secret | `8c3ea73db5a935dd9cc50d34ebc34c1cecb902b6c0923ff6c57d08e4592d7b3b62f1e0030e594cb402dab8321571d87980b3f270512b4bbe04d72b2305e75398` |
| `FRONTEND_URL` | The deployed Vercel URL | `https://mr-crunchos.vercel.app` |
| `PORT` | Web port used by the server | `5000` (Render will bind dynamically) |
| `NODE_ENV` | Running node environment | `production` |

### Frontend Configuration (Vercel)
Ensure this variable is set in the Vercel Dashboard under **Environment Variables**:

| Variable | Description | Example / Required Value |
|---|---|---|
| `VITE_API_URL` | The deployed Render Backend API URL | `https://crunchos-backend.onrender.com` |

---

## 2. Platform Build & Start Commands

### Backend (Render Web Service)
- **Runtime:** `Node`
- **Build Command:**
  ```bash
  npm install && npm run build
  ```
  *(Note: Render executes `tsc` compilation to output transcompiled JS into the `dist/` directory)*
- **Start Command:**
  ```bash
  node dist/server.js
  ```

### Frontend (Vercel Project)
- **Framework Preset:** `Vite`
- **Build Command:**
  ```bash
  npm run build
  ```
- **Output Directory:** `dist`
- **Install Command:** `npm install`

---

## 3. Database & Prisma Commands

During deployment, Prisma needs to synchronize the schema structure onto the PostgreSQL cluster. Run these tasks during your release build lifecycle or via Render Shell:

### Generate Prisma Client
Generates PostgreSQL-typed client interfaces locally on the runner:
```bash
npx prisma generate
```

### Apply Database Migrations
Executes all SQL migrations to synchronize table states on PostgreSQL:
```bash
npx prisma db push
```

### Seed Initial Cafe Menu Data
Creates the administrator (`admin@crunchos.com`) and default menus for Mr. Crunchos Cafe:
```bash
npm run prisma:seed
```

---

## 4. PostgreSQL Configuration Details
Ensure your PostgreSQL database:
- Allows inbound traffic from your Render Backend instance IP range.
- Has SSL active (`sslmode=require` in connection string).
- Set standard connection pooling configuration for production scaling if desired.

---

## 5. Step-by-Step Production Deployment Flow

1. **Database Provisioning:**
   - Create a PostgreSQL database instance on Render (or AWS RDS/Neon).
   - Copy the connection URL.

2. **Backend Services Setup (Render):**
   - Click **New +** ➡️ **Web Service** on Render.
   - Connect your GitHub Repository.
   - Set the Root Directory to `backend`.
   - Set the Build Command to `npm install && npm run build`.
   - Set the Start Command to `node dist/server.js`.
   - Under **Advanced**, add the environment variables listed in Section 1.
   - Wait for Render to deploy. Copy the generated Render URL (e.g. `https://crunchos-backend.onrender.com`).

3. **Frontend Services Setup (Vercel):**
   - Import your GitHub Repository on Vercel.
   - Set the Root Directory to `frontend`.
   - Set the Framework Preset to `Vite`.
   - Under Environment Variables, add `VITE_API_URL` with your Render backend URL.
   - Click **Deploy**. Vercel will build the React application and output the production hosting link.

4. **Verify CORS Alignments:**
   - Return to Render and update the backend's `FRONTEND_URL` environment variable to match the deployed Vercel domain. Restart the Render service.

5. **Prisma DB Sync & Seed:**
   - Execute `npx prisma db push` followed by `npm run prisma:seed` to prepare the database structure.

---

## 6. Rollback Procedures

If an issue occurs post-release:
1. **Git Revert:** Revert the branch to the previous stable release commit.
2. **Platform Redeploy:** Trigger redeployment on Vercel and Render using the reverted commit.
3. **Database Rollback:** If the database schema was modified, restore a database snapshot. Prisma migrations can be inspected via `npx prisma migrate status`.
