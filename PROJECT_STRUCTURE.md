# Project Structure and Architecture

This document describes the directory layout, component entry points, architecture, and core data flows of the CrunchOS Smart QR Restaurant SaaS.

---

## 1. Directory Layout

The project is structured as a monorepo containing two main parts: the backend server and the frontend client.

```
QR/
├── backend/                  # Node.js + Express + TypeScript Backend
│   ├── prisma/               # Prisma Database Schema and Seeding
│   │   ├── dev.db            # Local SQLite database (git-ignored)
│   │   ├── schema.prisma     # Prisma database models
│   │   └── seed.ts           # Seeding script for initial tables/staff/menu
│   ├── src/                  # Source Code
│   │   ├── config/           # App configuration files (database, socket)
│   │   ├── controllers/      # Route controllers (request handling logic)
│   │   ├── middleware/       # JWT auth and roles validation
│   │   ├── routes/           # Express router endpoints
│   │   ├── socket/           # Socket.IO event handler and utility methods
│   │   ├── types/            # TypeScript schemas and enums
│   │   └── server.ts         # Server entry point
│   ├── package.json          # Node dependencies and scripts
│   ├── tsconfig.json         # TypeScript configuration
│   └── .env                  # Local environment configurations (git-ignored)
│
├── frontend/                 # Vite + React + TypeScript Frontend
│   ├── public/               # Static public assets
│   ├── src/                  # React Application source files
│   │   ├── assets/           # Dynamic styles or SVG assets
│   │   ├── pages/            # Core views (Menu, Login, Dashboard, etc.)
│   │   │   ├── CustomerMenu.tsx   # QR code table menu + order cart
│   │   │   ├── StaffDashboard.tsx # Comprehensive admin/staff panel
│   │   │   └── StaffLogin.tsx     # Staff login form
│   │   ├── shared/           # Reusable code utilities
│   │   │   ├── components/   # UI components (ThemeToggle.tsx)
│   │   │   ├── hooks/        # Zustand stores and hooks (useAuth, useCart)
│   │   │   └── services/     # Socket client service
│   │   ├── App.css           # Global layout styles
│   │   ├── App.tsx           # React router routes
│   │   ├── index.css         # Styling system (TailwindCSS v4 + Dark Mode)
│   │   └── main.tsx          # Client entry point
│   ├── package.json          # Frontend packages
│   ├── tsconfig.json         # TypeScript configuration
│   ├── tailwind.config.js    # Tailwind layout customizations
│   └── vite.config.ts        # Vite build tool setup
│
├── docker-compose.yml        # Docker composition setup for dev/production databases
└── README.md                 # Primary system manual
```

---

## 2. Key Entry Points
- **Backend Entry Point:** [backend/src/server.ts](file:///c:/Users/Suzain%20Khan/Desktop/QR/backend/src/server.ts)  
  Sets up Express middleware (Helmet, CORS, JSON), starts the Socket.IO server, exposes API endpoints, and initializes the HTTP listener.
- **Frontend Entry Point:** [frontend/src/main.tsx](file:///c:/Users/Suzain%20Khan/Desktop/QR/frontend/src/main.tsx)  
  Mounts the React tree inside Vite and configures global Tailwind styles and rendering components.

---

## 3. Frontend Architecture
The frontend is built with React 19, Vite, TailwindCSS v4, and React Router v7.
- **State Management:** Uses **Zustand** stores for localized client states:
  - `useAuth.ts` stores credentials, user identities, and logged-in restaurant details, persisting them directly to LocalStorage.
  - `useCart.ts` manages the customer shopping cart (adding, modifying, and calculating order price details).
- **Socket Client:** The service `socket.ts` wraps the socket.io-client library, connecting to the backend dynamically on port 5000 and subscribing to order status changes.
- **Theme System:** Implements a global light/dark theme system. Supports manual toggle via `ThemeToggle.tsx` and falls back to system preferences. Persists selection in LocalStorage.

---

## 4. Backend Architecture
The backend is a TypeScript Node app structured using the **Controller-Route-Model** design pattern.
- **Routing:** Handled in [api.routes.ts](file:///c:/Users/Suzain%20Khan/Desktop/QR/backend/src/routes/api.routes.ts) using Express sub-routers.
- **Middleware:** Implements a JWT verification middleware [auth.ts](file:///c:/Users/Suzain%20Khan/Desktop/QR/backend/src/middleware/auth.ts) that checks Bearer tokens in incoming headers and guards routes.
- **Controllers:** Controllers process client inputs, query SQLite using Prisma ORM, execute actions, notify users via Socket.IO, and return JSON responses.

---

## 5. Main Flows

### A. Authentication Flow
1. **Login:** Staff logs in via `/api/auth/login` (Registration is disabled in MVP).
2. **Token Issuance:** The backend validates credentials, signs a JWT (using `JWT_SECRET`), and returns it to the client.
3. **Session Persistence:** The client-side Zustand store `useAuth` saves this token to LocalStorage.
4. **Subsequent API Calls:** The client automatically reads the token and appends it to headers: `Authorization: Bearer <JWT>`.

### B. Socket Flow
1. **Connection:** When a user visits the site, the socket client connects to `http://localhost:5000`.
2. **Channel Joining:**
   - Staff users join the `restaurant_${restaurantId}_staff` room automatically.
   - Customers tracking an order join the `order_${orderId}` room.
3. **Pushed Events:** When orders or service calls (e.g., water request) are submitted, controllers trigger the backend socket module to broadcast events (`order:new`, `request:new`, or `order:status_change`) to active rooms.

### C. Database Flow
1. **Querying:** Controllers import the shared database client [db.ts](file:///c:/Users/Suzain%20Khan/Desktop/QR/backend/src/config/db.ts).
2. **ORM Actions:** Database queries are translated dynamically to local SQLite commands via Prisma.
3. **Connection End:** On process interruption, Prisma disconnects from the database file safely.
