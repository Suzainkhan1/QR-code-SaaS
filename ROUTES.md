# Route Index Mapping

This document provides a consolidated list of all routing logic configured in the frontend application and backend server.

---

## 1. Frontend Routing (Client-Side)

Configured using React Router DOM in [App.tsx](file:///c:/Users/Suzain%20Khan/Desktop/QR/frontend/src/App.tsx):

| Route Path | Component rendered | Purpose | Navigation Context |
|---|---|---|---|
| `/table/:tableNumber` | `CustomerMenu` | Customer Menu Page | Scanned directly from physical QR codes on tables (1 to 20). |
| `/staff/login` | `StaffLogin` | Staff Login Panel | Accessible for the single Admin account. |
| `/staff/dashboard` | `StaffDashboard` | Staff Control Centre | Protected page for the verified Admin. |
| `*` | *Redirect fallback* | Redirects to `/staff/login` | Standard fallback route for general URL requests. |

### Dashboard Sub-Views (Tab-Based Routing)
The `StaffDashboard` manages different screens internally via state variables rather than URL changes. The views include:
* **Active Orders:** Kitchen display system and waiter dashboard tracking.
* **Table Layout:** Overview of table capacities and live occupancy statuses.
* **Menu Builder:** CRUD options for categories and menu items.
* **Staff Management:** View current logged in admin account (Self details).
* **Inventory Control:** Logbook of ingredients, stock levels, and threshold warnings.
* **Expense Manager:** Records of monthly expenses.
* **Analytics Reports:** Graphic representation of sales, cost lines, and revenue metrics.
* **Restaurant Settings:** Modify service charge, GST tax, and address fields.

---

## 2. Backend Routing (Server-Side)

### General System Routes
- **`GET /health`**: Health Check route. Queries database dynamically to ensure SQLite connections are healthy.
- **`GET /api-docs`**: Renders dynamic OpenAPI (Swagger) specifications.

### API Routes
All API endpoints are grouped under `/api/` and managed in [api.routes.ts](file:///c:/Users/Suzain%20Khan/Desktop/QR/backend/src/routes/api.routes.ts):

* **Public Customers:**
  * `GET /api/public/menu`
  * `GET /api/public/tables/:number`
  * `POST /api/public/orders`
  * `GET /api/public/orders/:id`
  * `POST /api/public/requests`
* **Authentication:**
  * `POST /api/auth/register` (Disabled - Returns 403)
  * `POST /api/auth/login`
  * `GET /api/auth/me` (Protected)
* **Staff CRUD:**
  * `POST /api/auth/staff` (Disabled - Returns 403)
  * `GET /api/auth/staff` (Protected)
  * `DELETE /api/auth/staff/:id` (Protected)
* **Menu Management:**
  * `GET /api/menu/categories` (Protected)
  * `POST /api/menu/categories` (Protected)
  * `PUT /api/menu/categories/:id` (Protected)
  * `DELETE /api/menu/categories/:id` (Protected)
  * `POST /api/menu/items` (Protected)
  * `PUT /api/menu/items/:id` (Protected)
  * `DELETE /api/menu/items/:id` (Protected)
* **Table Management:**
  * `GET /api/tables` (Protected)
  * `POST /api/tables` (Protected)
  * `PUT /api/tables/:id/status` (Protected)
  * `DELETE /api/tables/:id` (Protected)
* **Orders & Requests:**
  * `GET /api/orders` (Protected)
  * `PUT /api/orders/:id/status` (Protected)
  * `GET /api/requests` (Protected)
  * `PUT /api/requests/:id/resolve` (Protected)
* **Billing Settlements:**
  * `GET /api/billing/summary/:tableId` (Protected)
  * `POST /api/billing/checkout` (Protected)
  * `PUT /api/billing/:id/pay` (Protected)
* **Analytics, Inventory, & Financials:**
  * `GET /api/analytics` (Protected)
  * `GET /api/inventory` (Protected)
  * `POST /api/inventory` (Protected)
  * `PUT /api/inventory/:id` (Protected)
  * `DELETE /api/inventory/:id` (Protected)
  * `GET /api/expenses` (Protected)
  * `POST /api/expenses` (Protected)
  * `DELETE /api/expenses/:id` (Protected)
* **Settings & Audits:**
  * `GET /api/settings` (Protected)
  * `PUT /api/settings` (Protected)
  * `GET /api/logs` (Protected)
