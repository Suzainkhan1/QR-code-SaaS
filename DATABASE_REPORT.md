# Database Report

This document outlines the database type, schema models, connection details, and migrations configuration for the CrunchOS Restaurant SaaS.

---

## 1. Database Type
* **Database Type:** **SQLite** (Single-file local database).
* **Environment:** Fully local database setup. No cloud services or external servers (like Supabase, Firebase, MongoDB Atlas, etc.) are utilized.

---

## 2. Connection and Configuration Details
* **Connector File:** [backend/src/config/db.ts](file:///c:/Users/Suzain%20Khan/Desktop/QR/backend/src/config/db.ts) exports a singleton instance of `PrismaClient`.
* **Connection String:** Configured in `backend/.env` as:
  ```env
  DATABASE_URL="file:./dev.db"
  ```
  Points to [dev.db](file:///c:/Users/Suzain%20Khan/Desktop/QR/backend/prisma/dev.db) located in the `backend/prisma/` folder.
* **ORM:** **Prisma** (utilizing the `@prisma/client` package).

---

## 3. Active Models (Tables)
Prisma generates the following models based on [schema.prisma](file:///c:/Users/Suzain%20Khan/Desktop/QR/backend/prisma/schema.prisma):

1. **`Restaurant`**: Stores general restaurant info (name, slug, logo, tax rate, service charge config).
2. **`User`**: Admin account (Owner/Admin) with salted password hashes.
3. **`Table`**: Dining table layout details (table number, capacity, and active status).
4. **`MenuCategory`**: Category groupings for dishes (e.g., Sandwich, Pizza, Coolers).
5. **`MenuItem`**: Dish entries containing pricing, availability, veggie/non-veg status, and images.
6. **`Order`**: Tracks general customer orders, table relationships, totals, tax, and status.
7. **`OrderItem`**: Pivot table for dishes added to a customer order (linked to `Order` and `MenuItem`).
8. **`Bill`**: Finished checkout records containing physical settlements, invoices, payment methods, and timestamps.
9. **`StaffRequest`**: Custom service alerts from tables (e.g., requests for water, cleaning, bills, or waiter service).
10. **`InventoryItem`**: Tracks stock quantities of core ingredients with automatic low stock warning thresholds.
11. **`Expense`**: Logbook for restaurant costs (Rent, Salaries, Raw Materials, Maintenance, Utilities).
12. **`ActivityLog`**: Logging tool for audit trails (new orders, billing, and system operations).

---

## 4. Migrations and Seeding
* **Migrations:** There is no standard `migrations/` folder. The local schema is pushed directly to the SQLite binary file using:
  ```bash
  npx prisma db push
  ```
* **Seed Script File:** [backend/prisma/seed.ts](file:///c:/Users/Suzain%20Khan/Desktop/QR/backend/prisma/seed.ts)
  * Seeds a restaurant called **Mr. Crunchos Cafe** (`slug: mr-crunchos-cafe`).
  * Seeds a single administrator account (`admin@crunchos.com` / `password123`).
  * Generates 20 dining tables (`01` to `20`).
  * Fills all categories (Sandwich, Pizza, Pasta, Garlic Bread, Shakes, Coolers, Burgers, Quick Snacks, Desserts, Maggie) with complete descriptions and stock item details.

---

## 5. Database Dependencies
- **Production Packages:**
  - `@prisma/client` (^5.10.2)
- **Development Packages:**
  - `prisma` (^5.10.2)
