"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const enums_1 = require("../types/enums");
const auth_1 = require("../middleware/auth");
// Controller Imports
const auth_controller_1 = require("../controllers/auth.controller");
const menu_controller_1 = require("../controllers/menu.controller");
const table_controller_1 = require("../controllers/table.controller");
const order_controller_1 = require("../controllers/order.controller");
const request_controller_1 = require("../controllers/request.controller");
const billing_controller_1 = require("../controllers/billing.controller");
const analytics_controller_1 = require("../controllers/analytics.controller");
const inventory_controller_1 = require("../controllers/inventory.controller");
const expense_controller_1 = require("../controllers/expense.controller");
const settings_controller_1 = require("../controllers/settings.controller");
const log_controller_1 = require("../controllers/log.controller");
const router = (0, express_1.Router)();
// ==========================================
// 1. PUBLIC CUSTOMER ENDPOINTS
// ==========================================
router.get('/public/menu', menu_controller_1.getMenuBySlug);
router.get('/public/tables/:number', table_controller_1.verifyTable);
router.post('/public/orders', order_controller_1.createOrder);
router.get('/public/orders/:id', order_controller_1.getCustomerOrderStatus);
router.post('/public/requests', request_controller_1.createRequest);
// ==========================================
// 2. STAFF AUTHENTICATION & MANAGEMENT
// ==========================================
router.post('/auth/register', auth_controller_1.register);
router.post('/auth/login', auth_controller_1.login);
router.get('/auth/me', auth_1.authenticateJWT, auth_controller_1.me);
// Staff Accounts CRUD (Owner / Manager level)
router.post('/auth/staff', auth_1.authenticateJWT, (0, auth_1.requireRoles)(enums_1.Role.OWNER, enums_1.Role.MANAGER), auth_controller_1.addStaff);
router.get('/auth/staff', auth_1.authenticateJWT, auth_controller_1.getStaff);
router.delete('/auth/staff/:id', auth_1.authenticateJWT, (0, auth_1.requireRoles)(enums_1.Role.OWNER), auth_controller_1.deleteStaff);
// ==========================================
// 3. MENU MANAGEMENT
// ==========================================
router.get('/menu/categories', auth_1.authenticateJWT, menu_controller_1.getCategories);
router.post('/menu/categories', auth_1.authenticateJWT, (0, auth_1.requireRoles)(enums_1.Role.OWNER, enums_1.Role.MANAGER), menu_controller_1.addCategory);
router.put('/menu/categories/:id', auth_1.authenticateJWT, (0, auth_1.requireRoles)(enums_1.Role.OWNER, enums_1.Role.MANAGER), menu_controller_1.updateCategory);
router.delete('/menu/categories/:id', auth_1.authenticateJWT, (0, auth_1.requireRoles)(enums_1.Role.OWNER), menu_controller_1.deleteCategory);
router.post('/menu/items', auth_1.authenticateJWT, (0, auth_1.requireRoles)(enums_1.Role.OWNER, enums_1.Role.MANAGER), menu_controller_1.addItem);
router.put('/menu/items/:id', auth_1.authenticateJWT, (0, auth_1.requireRoles)(enums_1.Role.OWNER, enums_1.Role.MANAGER), menu_controller_1.updateItem);
router.delete('/menu/items/:id', auth_1.authenticateJWT, (0, auth_1.requireRoles)(enums_1.Role.OWNER), menu_controller_1.deleteItem);
// ==========================================
// 4. TABLE MANAGEMENT
// ==========================================
router.get('/tables', auth_1.authenticateJWT, table_controller_1.getTables);
router.post('/tables', auth_1.authenticateJWT, (0, auth_1.requireRoles)(enums_1.Role.OWNER, enums_1.Role.MANAGER), table_controller_1.addTable);
router.put('/tables/:id/status', auth_1.authenticateJWT, table_controller_1.updateTableStatus);
router.delete('/tables/:id', auth_1.authenticateJWT, (0, auth_1.requireRoles)(enums_1.Role.OWNER), table_controller_1.deleteTable);
// ==========================================
// 5. ORDERS & KITCHEN SYSTEM (KDS)
// ==========================================
router.get('/orders', auth_1.authenticateJWT, order_controller_1.getOrders);
router.put('/orders/:id/status', auth_1.authenticateJWT, order_controller_1.updateOrderStatus);
// ==========================================
// 6. CUSTOMER STAFF REQUESTS (WATER, SPOON, ETC)
// ==========================================
router.get('/requests', auth_1.authenticateJWT, request_controller_1.getRequests);
router.put('/requests/:id/resolve', auth_1.authenticateJWT, request_controller_1.resolveRequest);
// ==========================================
// 7. BILLING & PHYSICAL SETTLEMENT
// ==========================================
router.get('/billing/summary/:tableId', auth_1.authenticateJWT, billing_controller_1.getTableBillSummary);
router.post('/billing/checkout', auth_1.authenticateJWT, billing_controller_1.checkoutTable);
router.put('/billing/:id/pay', auth_1.authenticateJWT, billing_controller_1.payBill);
// ==========================================
// 8. FINANCIAL ANALYTICS
// ==========================================
router.get('/analytics', auth_1.authenticateJWT, (0, auth_1.requireRoles)(enums_1.Role.OWNER, enums_1.Role.MANAGER), analytics_controller_1.getAnalytics);
// ==========================================
// 9. INVENTORY MANAGEMENT
// ==========================================
router.get('/inventory', auth_1.authenticateJWT, inventory_controller_1.getInventory);
router.post('/inventory', auth_1.authenticateJWT, inventory_controller_1.addIngredient);
router.put('/inventory/:id', auth_1.authenticateJWT, inventory_controller_1.updateIngredient);
router.delete('/inventory/:id', auth_1.authenticateJWT, inventory_controller_1.deleteIngredient);
// ==========================================
// 10. EXPENSE MANAGER
// ==========================================
router.get('/expenses', auth_1.authenticateJWT, expense_controller_1.getExpenses);
router.post('/expenses', auth_1.authenticateJWT, expense_controller_1.addExpense);
router.delete('/expenses/:id', auth_1.authenticateJWT, expense_controller_1.deleteExpense);
// ==========================================
// 11. RESTAURANT SETTINGS & AUDIT LOGS
// ==========================================
router.get('/settings', auth_1.authenticateJWT, settings_controller_1.getSettings);
router.put('/settings', auth_1.authenticateJWT, (0, auth_1.requireRoles)(enums_1.Role.OWNER, enums_1.Role.MANAGER), settings_controller_1.updateSettings);
router.get('/logs', auth_1.authenticateJWT, log_controller_1.getActivityLogs);
exports.default = router;
