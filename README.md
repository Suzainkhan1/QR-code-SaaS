# Mr. Crunchos Cafe - Restaurant Management System (MVP)

This is a production-ready Restaurant Management System specifically configured for **Mr. Crunchos Cafe** (single-restaurant focus). It offers contactless QR-based menu scanning for customers (linked to tables 1-20), a live Kitchen Display System (KDS), waiter service alerts, checkout billing POS, inventory warning checks, expense logs, and a dynamic Light/Dark theme system.

---

## Tech Stack
* **Frontend:** React 19, TypeScript, Vite, TailwindCSS v4, React Router v7, Zustand, Framer Motion, Recharts.
* **Backend:** Node.js, Express, TypeScript, Socket.IO (for real-time events), Helmet (security middleware).
* **Database & ORM:** SQLite file database, Prisma ORM.

---

## Core Features
1. **Interactive QR Menu:** Table scanning (accessible via `/table/{tableNumber}`) redirects to the menu of Mr. Crunchos Cafe. Supports size/flavor customizations and real-time order tracking.
2. **Dynamic Themes:** Toggle between Light and Dark mode directly from the navigation bar on both client and staff views. Persists selection in LocalStorage and falls back to system preferences.
3. **Admin Dashboard POS:** Single dashboard for active orders, kitchen preparation queue, billing printouts, category/menu editor, inventory tracking, and sales logs.
4. **Real-time Notifications:** Sockets connect tables directly to the Admin dashboard toolbar.

---

## Installation & Setup

Ensure you have [Node.js (v18+)](https://nodejs.org/) installed locally.

### 1. Database Initialization
```bash
cd backend
# Install dependencies (if not present)
npm install
# Push Prisma schema to generate local SQLite database
npx prisma db push
# Seed the database
npm run prisma:seed
```

### 2. Start Backend Server
```bash
cd backend
# Starts server on http://localhost:5000
npm run dev
```

### 3. Start Frontend App
```bash
cd ../frontend
# Install dependencies (if not present)
npm install
# Starts development server on http://localhost:5173
npm run dev
```

---

## Administrator Login
* **Email:** `admin@crunchos.com`
* **Password:** `password123`

---

## Folder Structure
* `/backend`: Node.js server source code, routes, controllers, Socket handlers, database setup.
* `/frontend`: React SPA dashboard, page views, CSS styles, state management hooks.
* `/docker-compose.yml`: Contains database setup config for development.
