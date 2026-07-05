import { Router } from 'express';
import { Role } from '../types/enums';
import { authenticateJWT, requireRoles } from '../middleware/auth';
import rateLimit from 'express-rate-limit';
import { validateBody } from '../middleware/validate';
import {
  loginSchema,
  placeOrderSchema,
  staffRequestSchema,
  categorySchema,
  menuItemSchema,
  inventoryItemSchema,
  expenseSchema,
  checkoutSchema,
} from '../types/schemas';

// Controller Imports
import { register, login, me, addStaff, getStaff, deleteStaff } from '../controllers/auth.controller';
import { getMenuBySlug, getCategories, addCategory, updateCategory, deleteCategory, addItem, updateItem, deleteItem } from '../controllers/menu.controller';
import { verifyTable, verifyTableToken, getTables, addTable, updateTableStatus, deleteTable } from '../controllers/table.controller';
import { createOrder, getCustomerOrderStatus, getOrders, updateOrderStatus } from '../controllers/order.controller';
import { createRequest, getRequests, resolveRequest } from '../controllers/request.controller';
import { getTableBillSummary, checkoutTable, payBill } from '../controllers/billing.controller';
import { getAnalytics } from '../controllers/analytics.controller';
import { getInventory, addIngredient, updateIngredient, deleteIngredient } from '../controllers/inventory.controller';
import { getExpenses, addExpense, deleteExpense } from '../controllers/expense.controller';
import { getSettings, updateSettings } from '../controllers/settings.controller';
import { getActivityLogs } from '../controllers/log.controller';

const router = Router();

// Rate Limiters Configuration
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const publicApiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30,
  message: { error: 'Too many requests from this device. Please try again after 5 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ==========================================
// 1. PUBLIC CUSTOMER ENDPOINTS
// ==========================================

/**
 * @openapi
 * /api/public/menu:
 *   get:
 *     summary: Get the full public menu (categories + items) for the café
 *     tags: [Public]
 *     security: []
 *     responses:
 *       200:
 *         description: Menu retrieved successfully
 *       404:
 *         description: Restaurant not found
 */
router.get('/public/menu', getMenuBySlug);

/**
 * @openapi
 * /api/public/tables/{number}:
 *   get:
 *     summary: Look up a table by its number (legacy unsigned lookup)
 *     tags: [Public]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: number
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Table found
 *       404:
 *         description: Table or restaurant not found
 */
router.get('/public/tables/:number', verifyTable);

/**
 * @openapi
 * /api/public/tables/verify:
 *   post:
 *     summary: Verify a signed QR token and issue a short-lived customer session JWT
 *     tags: [Public]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [number, token]
 *             properties:
 *               number:
 *                 type: string
 *               token:
 *                 type: string
 *                 description: Signed QR token embedded in the printed QR code URL
 *     responses:
 *       200:
 *         description: Session verified, customer token issued
 *       400:
 *         description: Missing number or token
 *       403:
 *         description: Invalid or tampered QR token
 *       404:
 *         description: Table not found
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/public/tables/verify', publicApiLimiter, verifyTableToken);

/**
 * @openapi
 * /api/public/orders:
 *   post:
 *     summary: Place an order for the authenticated table/customer session
 *     tags: [Public]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tableId, items]
 *             properties:
 *               tableId:
 *                 type: string
 *                 format: uuid
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [menuItemId, quantity, price]
 *                   properties:
 *                     menuItemId:
 *                       type: string
 *                       format: uuid
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *                     price:
 *                       type: number
 *                     customs:
 *                       type: string
 *                     notes:
 *                       type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Order created
 *       400:
 *         description: Validation error or invalid order parameters
 *       401:
 *         description: Missing/invalid authentication token
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/public/orders', publicApiLimiter, authenticateJWT, validateBody(placeOrderSchema), createOrder);

/**
 * @openapi
 * /api/public/orders/{id}:
 *   get:
 *     summary: Track an order's current status and details
 *     tags: [Public]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Order details
 *       404:
 *         description: Order not found
 */
router.get('/public/orders/:id', getCustomerOrderStatus);

/**
 * @openapi
 * /api/public/requests:
 *   post:
 *     summary: Create a staff assistance request (water, tissue, bill, etc.)
 *     tags: [Public]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tableId, type]
 *             properties:
 *               tableId:
 *                 type: string
 *                 format: uuid
 *               type:
 *                 type: string
 *                 enum: [WATER, SPOON, TISSUE, BILL, CLEANING, CALL_WAITER]
 *     responses:
 *       201:
 *         description: Request created
 *       400:
 *         description: Validation error
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/public/requests', publicApiLimiter, authenticateJWT, validateBody(staffRequestSchema), createRequest);

// ==========================================
// 2. STAFF AUTHENTICATION & MANAGEMENT
// ==========================================

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new restaurant tenant (disabled for this single-café MVP)
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       403:
 *         description: Registration is disabled
 */
router.post('/auth/register', register);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Staff login
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Login successful, JWT issued
 *       400:
 *         description: Invalid credentials or validation error
 *       429:
 *         description: Too many login attempts
 */
router.post('/auth/login', loginLimiter, validateBody(loginSchema), login);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Get the currently authenticated staff user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user context
 *       401:
 *         description: Unauthorized
 */
router.get('/auth/me', authenticateJWT, me);

/**
 * @openapi
 * /api/auth/staff:
 *   post:
 *     summary: Add a new staff account (Owner/Manager only)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [OWNER, MANAGER, CASHIER, KITCHEN, WAITER, ADMIN]
 *     responses:
 *       201:
 *         description: Staff account created
 *       400:
 *         description: Missing fields or email already exists
 *       403:
 *         description: Insufficient role permissions
 *   get:
 *     summary: List all staff for the restaurant
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Staff list
 *       401:
 *         description: Unauthorized
 */
router.post('/auth/staff', authenticateJWT, requireRoles(Role.OWNER, Role.MANAGER), addStaff);
router.get('/auth/staff', authenticateJWT, getStaff);

/**
 * @openapi
 * /api/auth/staff/{id}:
 *   delete:
 *     summary: Delete a staff account (Owner only)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Staff member deleted
 *       400:
 *         description: Owner cannot delete their own account
 *       403:
 *         description: Insufficient role permissions
 *       404:
 *         description: Staff member not found
 */
router.delete('/auth/staff/:id', authenticateJWT, requireRoles(Role.OWNER), deleteStaff);

// ==========================================
// 3. MENU MANAGEMENT
// ==========================================

/**
 * @openapi
 * /api/menu/categories:
 *   get:
 *     summary: List menu categories
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Category list
 *   post:
 *     summary: Add a menu category (Owner/Manager only)
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Category created
 *       400:
 *         description: Validation error or duplicate name
 */
router.get('/menu/categories', authenticateJWT, getCategories);
router.post('/menu/categories', authenticateJWT, requireRoles(Role.OWNER, Role.MANAGER), validateBody(categorySchema), addCategory);

/**
 * @openapi
 * /api/menu/categories/{id}:
 *   put:
 *     summary: Update a menu category (Owner/Manager only)
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Category updated
 *       404:
 *         description: Category not found
 *   delete:
 *     summary: Delete a menu category (Owner only)
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Category (and its items) deleted
 *       404:
 *         description: Category not found
 */
router.put('/menu/categories/:id', authenticateJWT, requireRoles(Role.OWNER, Role.MANAGER), validateBody(categorySchema), updateCategory);
router.delete('/menu/categories/:id', authenticateJWT, requireRoles(Role.OWNER), deleteCategory);

/**
 * @openapi
 * /api/menu/items:
 *   post:
 *     summary: Add a menu item (Owner/Manager only)
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, price, categoryId, prepTime]
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *               prepTime:
 *                 type: integer
 *               isVeg:
 *                 type: boolean
 *               isBestseller:
 *                 type: boolean
 *               isChefSpecial:
 *                 type: boolean
 *               image:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Menu item created
 *       400:
 *         description: Validation error
 *       404:
 *         description: Category does not exist
 */
router.post('/menu/items', authenticateJWT, requireRoles(Role.OWNER, Role.MANAGER), validateBody(menuItemSchema), addItem);

/**
 * @openapi
 * /api/menu/items/{id}:
 *   put:
 *     summary: Update a menu item (Owner/Manager only)
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Menu item updated
 *       404:
 *         description: Menu item not found
 *   delete:
 *     summary: Delete a menu item (Owner only)
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Menu item deleted
 *       404:
 *         description: Menu item not found
 */
router.put('/menu/items/:id', authenticateJWT, requireRoles(Role.OWNER, Role.MANAGER), validateBody(menuItemSchema), updateItem);
router.delete('/menu/items/:id', authenticateJWT, requireRoles(Role.OWNER), deleteItem);

// ==========================================
// 4. TABLE MANAGEMENT
// ==========================================

/**
 * @openapi
 * /api/tables:
 *   get:
 *     summary: List all tables (includes printable QR URLs)
 *     tags: [Tables]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Table list
 *   post:
 *     summary: Add a new table (Owner/Manager only)
 *     tags: [Tables]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [number]
 *             properties:
 *               number:
 *                 type: string
 *               capacity:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Table created
 *       400:
 *         description: Table number already exists
 */
router.get('/tables', authenticateJWT, getTables);
router.post('/tables', authenticateJWT, requireRoles(Role.OWNER, Role.MANAGER), addTable);

/**
 * @openapi
 * /api/tables/{id}/status:
 *   put:
 *     summary: Update a table's status
 *     tags: [Tables]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [AVAILABLE, OCCUPIED, PREPARING, BILLING, CLEANING]
 *     responses:
 *       200:
 *         description: Table updated
 *       404:
 *         description: Table not found
 */
router.put('/tables/:id/status', authenticateJWT, updateTableStatus);

/**
 * @openapi
 * /api/tables/{id}:
 *   delete:
 *     summary: Delete a table (Owner only)
 *     tags: [Tables]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Table deleted
 *       404:
 *         description: Table not found
 */
router.delete('/tables/:id', authenticateJWT, requireRoles(Role.OWNER), deleteTable);

// ==========================================
// 5. ORDERS & KITCHEN SYSTEM (KDS)
// ==========================================

/**
 * @openapi
 * /api/orders:
 *   get:
 *     summary: List orders for the restaurant (kitchen display queue)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, ACCEPTED, PREPARING, COOKING, PACKING, READY, DELIVERED, CANCELLED]
 *     responses:
 *       200:
 *         description: Order list
 */
router.get('/orders', authenticateJWT, getOrders);

/**
 * @openapi
 * /api/orders/{id}/status:
 *   put:
 *     summary: Update an order's kitchen status
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, ACCEPTED, PREPARING, COOKING, PACKING, READY, DELIVERED, CANCELLED]
 *     responses:
 *       200:
 *         description: Order updated
 *       404:
 *         description: Order not found
 */
router.put('/orders/:id/status', authenticateJWT, updateOrderStatus);

// ==========================================
// 6. CUSTOMER STAFF REQUESTS (WATER, SPOON, ETC)
// ==========================================

/**
 * @openapi
 * /api/requests:
 *   get:
 *     summary: List pending staff assistance requests
 *     tags: [Requests]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending request list
 */
router.get('/requests', authenticateJWT, getRequests);

/**
 * @openapi
 * /api/requests/{id}/resolve:
 *   put:
 *     summary: Mark a staff assistance request as resolved
 *     tags: [Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Request resolved
 *       404:
 *         description: Request not found
 */
router.put('/requests/:id/resolve', authenticateJWT, resolveRequest);

// ==========================================
// 7. BILLING & PHYSICAL SETTLEMENT
// ==========================================

/**
 * @openapi
 * /api/billing/summary/{tableId}:
 *   get:
 *     summary: Get the current unpaid bill summary for a table's active session
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Bill summary
 *       404:
 *         description: Table not found
 */
router.get('/billing/summary/:tableId', authenticateJWT, getTableBillSummary);

/**
 * @openapi
 * /api/billing/checkout:
 *   post:
 *     summary: Generate a bill for a table's active session (Owner/Manager/Cashier only)
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tableId]
 *             properties:
 *               tableId:
 *                 type: string
 *                 format: uuid
 *               discount:
 *                 type: number
 *                 minimum: 0
 *     responses:
 *       201:
 *         description: Bill generated
 *       400:
 *         description: No active session/orders to check out
 *       403:
 *         description: Insufficient role permissions
 */
router.post('/billing/checkout', authenticateJWT, requireRoles(Role.OWNER, Role.MANAGER, Role.CASHIER), validateBody(checkoutSchema), checkoutTable);

/**
 * @openapi
 * /api/billing/{id}/pay:
 *   put:
 *     summary: Mark a bill as paid and settle the table (Owner/Manager/Cashier only)
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [paymentMethod]
 *             properties:
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, UPI, CARD]
 *     responses:
 *       200:
 *         description: Bill settled
 *       400:
 *         description: Invoice already paid or missing payment method
 *       403:
 *         description: Insufficient role permissions
 *       404:
 *         description: Invoice not found
 */
router.put('/billing/:id/pay', authenticateJWT, requireRoles(Role.OWNER, Role.MANAGER, Role.CASHIER), payBill);

// ==========================================
// 8. FINANCIAL ANALYTICS
// ==========================================

/**
 * @openapi
 * /api/analytics:
 *   get:
 *     summary: Get revenue, profit, best-sellers, peak hours and trend analytics (Owner/Manager only)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics report
 *       403:
 *         description: Insufficient role permissions
 */
router.get('/analytics', authenticateJWT, requireRoles(Role.OWNER, Role.MANAGER), getAnalytics);

// ==========================================
// 9. INVENTORY MANAGEMENT
// ==========================================

/**
 * @openapi
 * /api/inventory:
 *   get:
 *     summary: List inventory (raw material) items
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Inventory list
 *   post:
 *     summary: Add a raw material ingredient
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, quantity, unit]
 *             properties:
 *               name:
 *                 type: string
 *               quantity:
 *                 type: number
 *               unit:
 *                 type: string
 *               minStock:
 *                 type: number
 *     responses:
 *       201:
 *         description: Ingredient added
 *       400:
 *         description: Ingredient already exists or validation error
 */
router.get('/inventory', authenticateJWT, getInventory);
router.post('/inventory', authenticateJWT, validateBody(inventoryItemSchema), addIngredient);

/**
 * @openapi
 * /api/inventory/{id}:
 *   put:
 *     summary: Update stock levels/details for an ingredient
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Ingredient updated
 *       404:
 *         description: Ingredient not found
 *   delete:
 *     summary: Delete an inventory ingredient
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Ingredient deleted
 *       404:
 *         description: Ingredient not found
 */
router.put('/inventory/:id', authenticateJWT, validateBody(inventoryItemSchema), updateIngredient);
router.delete('/inventory/:id', authenticateJWT, deleteIngredient);

// ==========================================
// 10. EXPENSE MANAGER
// ==========================================

/**
 * @openapi
 * /api/expenses:
 *   get:
 *     summary: List expense records
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Expense list
 *   post:
 *     summary: Log a new expense
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [category, amount]
 *             properties:
 *               category:
 *                 type: string
 *               amount:
 *                 type: number
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Expense recorded
 *       400:
 *         description: Validation error
 */
router.get('/expenses', authenticateJWT, getExpenses);
router.post('/expenses', authenticateJWT, validateBody(expenseSchema), addExpense);

/**
 * @openapi
 * /api/expenses/{id}:
 *   delete:
 *     summary: Delete an expense record
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Expense deleted
 *       404:
 *         description: Expense not found
 */
router.delete('/expenses/:id', authenticateJWT, deleteExpense);

// ==========================================
// 11. RESTAURANT SETTINGS & AUDIT LOGS
// ==========================================

/**
 * @openapi
 * /api/settings:
 *   get:
 *     summary: Get restaurant configuration
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Restaurant settings
 *   put:
 *     summary: Update restaurant configuration (Owner/Manager only)
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               address:
 *                 type: string
 *               taxRate:
 *                 type: number
 *               serviceCharge:
 *                 type: number
 *               logo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Settings updated
 *       403:
 *         description: Insufficient role permissions
 */
router.get('/settings', authenticateJWT, getSettings);
router.put('/settings', authenticateJWT, requireRoles(Role.OWNER, Role.MANAGER), updateSettings);

/**
 * @openapi
 * /api/logs:
 *   get:
 *     summary: Get the most recent 100 activity log entries
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Activity log list
 */
router.get('/logs', authenticateJWT, getActivityLogs);

export default router;