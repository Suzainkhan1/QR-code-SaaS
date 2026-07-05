# API Documentation Report

This document reports every Express backend route exposed in the system, detailing method types, auth requirements, payloads, and response data formats.

---

## 1. Public Customer Endpoints

These endpoints are triggered by QR scans or customer menus and do not require user authentication.

### `GET /api/public/menu`
- **Purpose:** Fetches the restaurant details and all categories with their menu items for the single café.
- **Authentication:** None.
- **Output (200 OK):**
  ```json
  {
    "restaurant": {
      "id": "restaurant-uuid",
      "name": "Mr. Crunchos Cafe",
      "logo": "url",
      "taxRate": 5,
      "serviceCharge": 0
    },
    "categories": [
      {
        "id": "category-uuid",
        "name": "Sandwich",
        "items": [
          { "id": "item-uuid", "name": "Veggie Grilled Sandwich", "price": 149 }
        ]
      }
    ]
  }
  ```
- **Errors:** `404 Not Found` if no restaurant setup exists in the database.

### `GET /api/public/tables/:number`
- **Purpose:** Verifies that a specific table exists and retrieves its configuration.
- **Authentication:** None.
- **Output (200 OK):**
  ```json
  {
    "table": { "id": "table-uuid", "number": "04", "status": "AVAILABLE" },
    "restaurant": { "id": "restaurant-uuid", "name": "Mr. Crunchos Cafe", "slug": "mr-crunchos-cafe", "taxRate": 5 }
  }
  ```
- **Errors:** `404 Not Found` if table is invalid.

### `POST /api/public/orders`
- **Purpose:** Places a new order from a customer's table.
- **Authentication:** None.
- **Input (JSON):**
  ```json
  {
    "tableId": "table-uuid",
    "items": [
      { "menuItemId": "item-uuid", "quantity": 2, "price": 149, "notes": "extra cheese", "customs": "{\"Extra Cheese\":true}" }
    ],
    "notes": "make it spicy"
  }
  ```
- **Output (201 Created):**
  ```json
  {
    "id": "order-uuid",
    "shortId": "1001",
    "status": "PENDING",
    "totalAmount": 298,
    "grandTotal": 312.9
  }
  ```

### `GET /api/public/orders/:id`
- **Purpose:** Fetches the active status of a customer order for live tracking.
- **Authentication:** None.
- **Output (200 OK):** Current order object along with related order items.

### `POST /api/public/requests`
- **Purpose:** Customer registers a table help request (e.g. water request).
- **Authentication:** None.
- **Input (JSON):**
  ```json
  {
    "tableId": "table-uuid",
    "type": "WATER" // WATER, SPOON, TISSUE, BILL, CLEANING, CALL_WAITER
  }
  ```
- **Output (201 Created):**
  ```json
  { "id": "request-uuid", "tableId": "table-uuid", "type": "WATER", "status": "PENDING" }
  ```

---

## 2. Staff Authentication & Management

### `POST /api/auth/register` (Disabled)
- **Purpose:** Disabled in MVP to restrict creation of multiple tenants/owners.
- **Output:** `403 Forbidden` JSON error.

### `POST /api/auth/login`
- **Purpose:** Authenticates the Admin account.
- **Authentication:** None.
- **Input (JSON):** `{ "email": "admin@crunchos.com", "password": "password123" }`
- **Output (200 OK):** `{ "token": "jwt-token-string", "user": { "id": "uuid", "role": "OWNER" }, "restaurant": { "id": "uuid" } }`

### `GET /api/auth/me`
- **Purpose:** Gets active logged-in profile data.
- **Authentication:** Bearer JWT.
- **Output (200 OK):** User and restaurant details.

### `POST /api/auth/staff` (Disabled)
- **Purpose:** Disabled in MVP to comply with single administrator constraint.
- **Output:** `403 Forbidden` JSON error.

---

## 3. Menu Management

All routes here require **Bearer JWT** authentication.

- **`GET /api/menu/categories`**: Lists categories.
- **`POST /api/menu/categories`**: Creates a category. Input: `{ "name": "Desserts", "description": "Sweet treats" }`.
- **`PUT /api/menu/categories/:id`**: Edits a category.
- **`DELETE /api/menu/categories/:id`**: Removes a category.
- **`POST /api/menu/items`**: Creates a dish. Input: `{ "name": "Brownie", "price": 99, "categoryId": "uuid" }`.
- **`PUT /api/menu/items/:id`**: Edits a dish.
- **`DELETE /api/menu/items/:id`**: Removes a dish.

---

## 4. Table Management

Requires **Bearer JWT** authentication.

- **`GET /api/tables`**: Lists all tables.
- **`POST /api/tables`**: Creates a new table. Input: `{ "number": "21", "capacity": 6 }`.
- **`PUT /api/tables/:id/status`**: Updates status (e.g. `OCCUPIED`, `CLEANING`). Input: `{ "status": "CLEANING" }`.
- **`DELETE /api/tables/:id`**: Deletes a table.

---

## 5. Kitchen Display System (KDS) & Staff Requests

Requires **Bearer JWT** authentication.

- **`GET /api/orders`**: Retrieves orders.
- **`PUT /api/orders/:id/status`**: Updates order status (`PREPARING`, `READY`, etc.). Input: `{ "status": "COOKING" }`.
- **`GET /api/requests`**: Lists pending customer service calls.
- **`PUT /api/requests/:id/resolve`**: Marks customer request as `RESOLVED`.

---

## 6. Billing and Checkout

Requires **Bearer JWT** authentication.

- **`GET /api/billing/summary/:tableId`**: Gets totals for all active unpaid orders on a table.
- **`POST /api/billing/checkout`**: Consolidates table orders, generates an invoice, and marks the table as `BILLING`. Input: `{ "tableId": "uuid" }`.
- **`PUT /api/billing/:id/pay`**: Marks invoice as paid and releases table to `AVAILABLE`. Input: `{ "paymentMethod": "CASH" }`.

---

## 7. Additional Modules (Analytics, Inventory, Expenses, Logs)

Requires **Bearer JWT** authentication.

- **`GET /api/analytics`**: Gets total revenue, cost trends, bestsellers, and stock warnings.
- **`GET /api/inventory`**: Lists raw stock items.
- **`POST /api/inventory`**: Creates ingredient. Input: `{ "name": "Milk", "quantity": 10, "unit": "litres", "minStock": 2 }`.
- **`PUT /api/inventory/:id`**: Edits stock items.
- **`DELETE /api/inventory/:id`**: Deletes ingredients.
- **`GET /api/expenses`**: Lists costs.
- **`POST /api/expenses`**: Adds cost. Input: `{ "category": "Rent", "amount": 25000 }`.
- **`DELETE /api/expenses/:id`**: Removes cost.
- **`GET /api/settings`**: Gets restaurant settings.
- **`PUT /api/settings`**: Updates tax rates, service charges, address.
- **`GET /api/logs`**: Lists activity audit trails.
