# Project TODO and Technical Debt Report

This document reports open tasks, mock configurations, missing integrations, and pending security/validation checks in the current codebase.

---

## 1. Mock Integrations & Dummy Controls

### A. Payment Gateway Integration
- **Status:** **Not Implemented**
- **Detail:** The checkout process on the staff dashboard provides payment buttons ("Pay Cash", "Pay Card", "Pay UPI") which instantly mark bills as paid (`isPaid = true` and hits `/api/billing/:id/pay`). There is no integration with active gateway webhooks (such as Stripe, Razorpay, or PayPal).

### B. Image Media Hosting
- **Status:** **Partially Mocked**
- **Detail:** Menu items depend on external stock image links (e.g. Unsplash placeholders). Adding or modifying items does not allow physical image uploads to the server storage or direct uploads to services like Cloudinary (even though Cloudinary configs exist in the `.env` settings, they are not wired up to file drop components).

---

## 2. Technical Debt and Missing Features

### A. Client-Side Input Validations
- **Registration Form:** Disabled for MVP, but the login form should validate basic email shapes.
- **Menu Inputs:** The fields for item pricing and prep times should reject negative numbers and restrict special character characters.

### B. Database Migration Path
- **Current Setup:** SQLite is configured. If the restaurant has concurrent tables calling the menu API, SQLite database locks (`SQLITE_BUSY`) might occur.
- **Requirement:** Migrating the schema datasource to a server-side PostgreSQL or MySQL instance for production workloads.

---

## 3. Recommended Optimization Work (Future Backlog)
- **Code Splitting:** The production Vite build triggers warnings because chunk sizes exceed 500kB. Implementing React lazy loading (`React.lazy()` / `<Suspense>`) on the Dashboard tabs will optimize the build sizes.
- **Unified API Service:** Currently, each frontend component calls `fetch("http://localhost:5000/api/...")` with inline headers and token parsing. Consolidating this into a central HttpClient service (using Axios or fetch wrappers) with automatic headers interceptors would make the client-side code cleaner.
