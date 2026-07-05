# Code Audit Report

This report documents code structures, potential security vulnerabilities, performance optimization areas, and deprecated code blocks identified in the CrunchOS repository.

---

## 1. Architectural Code Concerns

### A. Hardcoded API URLs
- **Vulnerability:** Multiple frontend pages (e.g. `StaffDashboard.tsx`, `CustomerMenu.tsx`, `StaffLogin.tsx`, and `socket.ts`) contain hardcoded URLs referencing `http://localhost:5000`.
- **Impact:** Impedes deployment to staging or production. Changing backend addresses requires manually updating multiple files.
- **Recommendation:** Replace all instances of `http://localhost:5000` with a centralized Axios or Fetch configuration, reading from a Vite environment variable (`import.meta.env.VITE_API_URL`).

### B. Unused Styling Files
- **Files:** [App.css](file:///c:/Users/Suzain%20Khan/Desktop/QR/frontend/src/App.css) contains minimal styles that could be moved directly into [index.css](file:///c:/Users/Suzain%20Khan/Desktop/QR/frontend/src/index.css) to clean up root workspace paths.

---

## 2. Security Assessment

### A. Fallback Secrets
- **Observation:** If the server is started without a loaded env file, config layers have a default fallback secret string: `"crunchos_jwt_secret_key_2026_super_secure"`.
- **Impact:** High security risk. If deployed with fallbacks, anyone can forge JWT signatures.
- **Recommendation:** Modify [auth.ts](file:///c:/Users/Suzain%20Khan/Desktop/QR/backend/src/middleware/auth.ts) to throw an explicit startup error if `process.env.JWT_SECRET` is not set.

### B. CORS Settings in Dev Mode
- **Observation:** The backend server sets `origin: "*"` inside Express CORS configuration.
- **Impact:** Useful for dev, but allows any external site to make requests to internal API ports in production.
- **Recommendation:** Restrict allowed origins to designated domains in production.

---

## 3. Performance Optimization Areas

### A. SQLite Concurrency Constraints
- **Observation:** SQLite locks the entire database file during write events (`dev.db`).
- **Impact:** In a busy restaurant environment where multiple tables are writing orders simultaneously, write timeouts or transaction failures can occur.
- **Recommendation:** Migrate production datasource setting to PostgreSQL or MySQL, which support table/row-level locks.

### B. React Bundle Chunk Size
- **Observation:** Production Vite builds trigger warnings because the single vendor asset chunk size exceeds 500kB.
- **Impact:** Increases load time.
- **Recommendation:** Implement code-splitting and dynamic imports for heavy dashboard components.
