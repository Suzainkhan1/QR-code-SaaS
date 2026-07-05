import { Router } from 'express';
import { Role } from '../types/enums';
import { authenticateJWT, requireRoles } from '../middleware/auth';

// Controller Imports
import { register, login, me, addStaff, getStaff, deleteStaff } from '../controllers/auth.controller';
import { getMenuBySlug, getCategories, addCategory, updateCategory, deleteCategory, addItem, updateItem, deleteItem } from '../controllers/menu.controller';
import { verifyTable, getTables, addTable, updateTableStatus, deleteTable } from '../controllers/table.controller';
import { createOrder, getCustomerOrderStatus, getOrders, updateOrderStatus } from '../controllers/order.controller';
import { createRequest, getRequests, resolveRequest } from '../controllers/request.controller';
import { getTableBillSummary, checkoutTable, payBill } from '../controllers/billing.controller';
import { getAnalytics } from '../controllers/analytics.controller';
import { getInventory, addIngredient, updateIngredient, deleteIngredient } from '../controllers/inventory.controller';
import { getExpenses, addExpense, deleteExpense } from '../controllers/expense.controller';
import { getSettings, updateSettings } from '../controllers/settings.controller';
import { getActivityLogs } from '../controllers/log.controller';

const router = Router();

// ==========================================
// 1. PUBLIC CUSTOMER ENDPOINTS
// ==========================================
router.get('/public/menu', getMenuBySlug);
router.get('/public/tables/:number', verifyTable);
router.post('/public/orders', createOrder);
router.get('/public/orders/:id', getCustomerOrderStatus);
router.post('/public/requests', createRequest);

// ==========================================
// 2. STAFF AUTHENTICATION & MANAGEMENT
// ==========================================
router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/me', authenticateJWT, me);

// Staff Accounts CRUD (Owner / Manager level)
router.post('/auth/staff', authenticateJWT, requireRoles(Role.OWNER, Role.MANAGER), addStaff);
router.get('/auth/staff', authenticateJWT, getStaff);
router.delete('/auth/staff/:id', authenticateJWT, requireRoles(Role.OWNER), deleteStaff);

// ==========================================
// 3. MENU MANAGEMENT
// ==========================================
router.get('/menu/categories', authenticateJWT, getCategories);
router.post('/menu/categories', authenticateJWT, requireRoles(Role.OWNER, Role.MANAGER), addCategory);
router.put('/menu/categories/:id', authenticateJWT, requireRoles(Role.OWNER, Role.MANAGER), updateCategory);
router.delete('/menu/categories/:id', authenticateJWT, requireRoles(Role.OWNER), deleteCategory);

router.post('/menu/items', authenticateJWT, requireRoles(Role.OWNER, Role.MANAGER), addItem);
router.put('/menu/items/:id', authenticateJWT, requireRoles(Role.OWNER, Role.MANAGER), updateItem);
router.delete('/menu/items/:id', authenticateJWT, requireRoles(Role.OWNER), deleteItem);

// ==========================================
// 4. TABLE MANAGEMENT
// ==========================================
router.get('/tables', authenticateJWT, getTables);
router.post('/tables', authenticateJWT, requireRoles(Role.OWNER, Role.MANAGER), addTable);
router.put('/tables/:id/status', authenticateJWT, updateTableStatus);
router.delete('/tables/:id', authenticateJWT, requireRoles(Role.OWNER), deleteTable);

// ==========================================
// 5. ORDERS & KITCHEN SYSTEM (KDS)
// ==========================================
router.get('/orders', authenticateJWT, getOrders);
router.put('/orders/:id/status', authenticateJWT, updateOrderStatus);

// ==========================================
// 6. CUSTOMER STAFF REQUESTS (WATER, SPOON, ETC)
// ==========================================
router.get('/requests', authenticateJWT, getRequests);
router.put('/requests/:id/resolve', authenticateJWT, resolveRequest);

// ==========================================
// 7. BILLING & PHYSICAL SETTLEMENT
// ==========================================
router.get('/billing/summary/:tableId', authenticateJWT, getTableBillSummary);
router.post('/billing/checkout', authenticateJWT, checkoutTable);
router.put('/billing/:id/pay', authenticateJWT, payBill);

// ==========================================
// 8. FINANCIAL ANALYTICS
// ==========================================
router.get('/analytics', authenticateJWT, requireRoles(Role.OWNER, Role.MANAGER), getAnalytics);

// ==========================================
// 9. INVENTORY MANAGEMENT
// ==========================================
router.get('/inventory', authenticateJWT, getInventory);
router.post('/inventory', authenticateJWT, addIngredient);
router.put('/inventory/:id', authenticateJWT, updateIngredient);
router.delete('/inventory/:id', authenticateJWT, deleteIngredient);

// ==========================================
// 10. EXPENSE MANAGER
// ==========================================
router.get('/expenses', authenticateJWT, getExpenses);
router.post('/expenses', authenticateJWT, addExpense);
router.delete('/expenses/:id', authenticateJWT, deleteExpense);

// ==========================================
// 11. RESTAURANT SETTINGS & AUDIT LOGS
// ==========================================
router.get('/settings', authenticateJWT, getSettings);
router.put('/settings', authenticateJWT, requireRoles(Role.OWNER, Role.MANAGER), updateSettings);
router.get('/logs', authenticateJWT, getActivityLogs);

export default router;
