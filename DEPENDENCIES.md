# Project Dependencies Report

This document reports package installations, version settings, and optimization opportunities across the backend and frontend components.

---

## 1. Backend Dependencies

Taken from [package.json](file:///c:/Users/Suzain%20Khan/Desktop/QR/backend/package.json):

### Production Dependencies
- **`@prisma/client`** (`^5.10.2`): Database client wrapper.
- **`bcryptjs`** (`^2.4.3`): Library for password salting and hashing.
- **`cors`** (`^2.8.5`): Enables Cross-Origin Resource Sharing.
- **`dotenv`** (`^16.4.5`): Node configuration manager via environment files.
- **`express`** (`^4.18.3`): Core web framework.
- **`helmet`** (`^7.1.0`): Protects Express headers to enhance server security.
- **`jsonwebtoken`** (`^9.0.2`): Signs and parses authorization tokens.
- **`multer`** (`^1.4.5-lts.1`): Processes multipart form-data for uploads.
- **`socket.io`** (`^4.7.4`): Enables real-time Socket updates.
- **`swagger-jsdoc`** (`^6.2.8`): Generates OpenAPI documents.
- **`swagger-ui-express`** (`^5.0.0`): Serves Swagger API docs interface.

### Development Dependencies
- **`prisma`** (`^5.10.2`): Database migration and model compiler.
- **`ts-node`** (`^10.9.2`): Runs TypeScript files directly.
- **`ts-node-dev`** (`^2.0.0`): Auto-reloading developer runtime.
- **`typescript`** (`^5.3.3`): Code compilation tool.
- **`rimraf`** (`^5.0.5`): Clean distribution directory script.
- **Type definitions:** `@types/bcryptjs`, `@types/cors`, `@types/express`, `@types/jsonwebtoken`, `@types/multer`, `@types/node`, `@types/swagger-jsdoc`, `@types/swagger-ui-express`.

---

## 2. Frontend Dependencies

Taken from [package.json](file:///c:/Users/Suzain%20Khan/Desktop/QR/frontend/package.json):

### Production Dependencies
- **`react`** (`^19.2.7`): UI framework core.
- **`react-dom`** (`^19.2.7`): DOM mount handlers.
- **`react-router-dom`** (`^7.18.1`): App client-side routing.
- **`framer-motion`** (`^12.42.2`): UI animations library.
- **`lucide-react`** (`^1.23.0`): Icon collections.
- **`recharts`** (`^3.9.2`): Graph rendering engine for analytics dashboard.
- **`socket.io-client`** (`^4.8.3`): Client-side Socket handler.
- **`zustand`** (`^5.0.14`): Lightweight persisted state store.

### Development Dependencies
- **`tailwindcss`** (`^4.3.2`): CSS styling engine.
- **`@tailwindcss/postcss`** (`^4.3.2`): Tailwind PostCSS loader plugin.
- **`postcss`** (`^8.5.16`): Style processing utility.
- **`autoprefixer`** (`^10.5.2`): Style vendor prefix compiler.
- **`vite`** (`^8.1.1`): Modern build tool and dev server.
- **`@vitejs/plugin-react`** (`^6.0.3`): React compiler helper for Vite.
- **`typescript`** (`~6.0.2`): TypeScript language engine.
- **`oxlint`** (`^1.71.0`): High-performance linter.
- **Type definitions:** `@types/node`, `@types/react`, `@types/react-dom`.

---

## 3. Unused Dependencies & Cleanup Recommendations

1. **`multer` (Backend):** The project imports `multer` but does not utilize file uploads or disk storage (menu items currently use hardcoded Unsplash URLs or base64 data). If image uploads are handled on the client (e.g. uploaded directly to Cloudinary/Firebase), `multer` can be removed.
2. **`swagger-jsdoc` / `swagger-ui-express` (Backend):** Highly useful for documentation, but if external API documentation tools are preferred or if docs are not kept up to date, these packages can be removed to reduce bundle size.
3. **`App.css` (Frontend):** It contains very minimal styles that can be merged directly into `index.css`.
