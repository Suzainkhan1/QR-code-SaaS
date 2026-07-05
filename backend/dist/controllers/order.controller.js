"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrderStatus = exports.getOrders = exports.getCustomerOrderStatus = exports.createOrder = void 0;
const db_1 = require("../config/db");
const client_1 = require("@prisma/client");
const socket_1 = require("../socket");
// PUBLIC: Customer places an order
const createOrder = async (req, res) => {
    let { tableId, restaurantId, items, notes } = req.body;
    // Security: enforce verified tableId and restaurantId from JWT token for CUSTOMERs
    if (req.user?.role === 'CUSTOMER') {
        tableId = req.user.tableId;
        restaurantId = req.user.restaurantId;
    }
    if (!tableId || !restaurantId || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Invalid order request parameters' });
    }
    try {
        const restaurant = await db_1.prisma.restaurant.findUnique({
            where: { id: restaurantId },
        });
        if (!restaurant) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }
        const table = await db_1.prisma.table.findUnique({
            where: { id: tableId },
        });
        if (!table || table.restaurantId !== restaurantId) {
            return res.status(404).json({ error: 'Table not found' });
        }
        // Get or create active session
        let activeSessionId = req.user?.sessionId;
        if (!activeSessionId) {
            const activeSession = await db_1.prisma.tableSession.findFirst({
                where: { tableId, isActive: true },
            });
            if (activeSession) {
                activeSessionId = activeSession.id;
            }
            else {
                const newSession = await db_1.prisma.tableSession.create({
                    data: {
                        tableId,
                        restaurantId,
                        isActive: true,
                    },
                });
                activeSessionId = newSession.id;
            }
        }
        // Calculate billing amounts based on DB prices to prevent tampering
        let subTotal = 0;
        const orderItemsToCreate = [];
        for (const item of items) {
            const menuItem = await db_1.prisma.menuItem.findFirst({
                where: { id: item.menuItemId, restaurantId },
            });
            if (!menuItem) {
                return res.status(400).json({ error: `Menu item ${item.menuItemId} not found` });
            }
            if (!menuItem.isAvailable) {
                return res.status(400).json({ error: `${menuItem.name} is currently out of stock` });
            }
            const itemCost = menuItem.price * item.quantity;
            subTotal += itemCost;
            orderItemsToCreate.push({
                menuItemId: menuItem.id,
                quantity: item.quantity,
                price: menuItem.price,
                customs: item.customs ? JSON.stringify(item.customs) : null,
                notes: item.notes || null,
            });
        }
        const taxAmount = Math.round(subTotal * (restaurant.taxRate / 100) * 100) / 100;
        const grandTotal = subTotal + taxAmount;
        // Generate short ID
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const orderCountToday = await db_1.prisma.order.count({
            where: {
                restaurantId,
                createdAt: { gte: todayStart },
            },
        });
        const shortId = `#${(1001 + orderCountToday).toString()}`;
        // Transaction to create order, update inventory, and update table status
        const order = await db_1.prisma.$transaction(async (tx) => {
            // 1. Deduct ingredient stock based on Recipe/BOM
            for (const item of orderItemsToCreate) {
                const recipeIngredients = await tx.menuItemIngredient.findMany({
                    where: { menuItemId: item.menuItemId },
                });
                for (const recipe of recipeIngredients) {
                    const qtyToDeduct = recipe.quantityUsed * item.quantity;
                    const updatedIngredient = await tx.inventoryItem.update({
                        where: { id: recipe.ingredientId },
                        data: {
                            quantity: {
                                decrement: qtyToDeduct,
                            },
                        },
                    });
                    // Check if below minStock and alert staff
                    if (updatedIngredient.quantity < updatedIngredient.minStock) {
                        (0, socket_1.notifyStaff)(restaurantId, 'inventory:low_stock', {
                            id: updatedIngredient.id,
                            name: updatedIngredient.name,
                            quantity: updatedIngredient.quantity,
                            minStock: updatedIngredient.minStock,
                            unit: updatedIngredient.unit,
                        });
                    }
                }
            }
            // 2. Create the order
            const dbOrder = await tx.order.create({
                data: {
                    shortId,
                    status: client_1.OrderStatus.PENDING,
                    tableId,
                    restaurantId,
                    totalAmount: subTotal,
                    taxAmount,
                    grandTotal,
                    notes,
                    sessionId: activeSessionId,
                    items: {
                        create: orderItemsToCreate,
                    },
                },
                include: {
                    table: true,
                    items: {
                        include: {
                            menuItem: true,
                        },
                    },
                },
            });
            // 3. Mark Table status as OCCUPIED
            await tx.table.update({
                where: { id: tableId },
                data: { status: client_1.TableStatus.OCCUPIED },
            });
            return dbOrder;
        });
        // Write activity log
        await db_1.prisma.activityLog.create({
            data: {
                action: 'New Order',
                details: `Table ${table.number} placed order ${shortId} for ₹${grandTotal}`,
                restaurantId,
            },
        });
        // Notify Staff Dashboard in Real-time
        (0, socket_1.notifyStaff)(restaurantId, 'order:new', order);
        // Notify other staff about table status change
        (0, socket_1.notifyStaff)(restaurantId, 'table:update', {
            action: 'update',
            table: { ...order.table, status: client_1.TableStatus.OCCUPIED },
        });
        return res.status(201).json({ order });
    }
    catch (error) {
        console.error('Order creation error:', error);
        return res.status(500).json({ error: 'Server error placing order' });
    }
};
exports.createOrder = createOrder;
// PUBLIC: Customer tracks their order details and preparation state
const getCustomerOrderStatus = async (req, res) => {
    const { id } = req.params;
    try {
        const order = await db_1.prisma.order.findUnique({
            where: { id },
            include: {
                table: true,
                restaurant: {
                    select: { name: true, taxRate: true, serviceCharge: true },
                },
                items: {
                    include: { menuItem: true },
                },
            },
        });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        return res.json({ order });
    }
    catch (error) {
        return res.status(500).json({ error: 'Server error fetching order details' });
    }
};
exports.getCustomerOrderStatus = getCustomerOrderStatus;
// STAFF: Get orders queue
const getOrders = async (req, res) => {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId)
        return res.status(401).json({ error: 'Unauthorized context' });
    const { status } = req.query;
    try {
        const orders = await db_1.prisma.order.findMany({
            where: {
                restaurantId,
                status: status ? status : undefined,
            },
            include: {
                table: true,
                items: {
                    include: { menuItem: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return res.json({ orders });
    }
    catch (error) {
        return res.status(500).json({ error: 'Server error listing orders' });
    }
};
exports.getOrders = getOrders;
// STAFF: Update order status (ACCEPTED, PREPARING, COOKING, PACKING, READY, DELIVERED, CANCELLED)
const updateOrderStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId)
        return res.status(401).json({ error: 'Unauthorized' });
    if (!status)
        return res.status(400).json({ error: 'Status is required' });
    try {
        const order = await db_1.prisma.order.findFirst({
            where: { id, restaurantId },
            include: { table: true },
        });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        const previousStatus = order.status;
        const updatedOrder = await db_1.prisma.order.update({
            where: { id },
            data: { status: status },
            include: {
                table: true,
                items: {
                    include: { menuItem: true },
                },
            },
        });
        // Auto-update table status dynamically based on order states
        let tableStatusUpdate = null;
        if (status === client_1.OrderStatus.READY) {
            // Order is ready! Table goes to Occupied but is preparing to billing
            tableStatusUpdate = client_1.TableStatus.OCCUPIED;
        }
        else if (status === client_1.OrderStatus.DELIVERED) {
            tableStatusUpdate = client_1.TableStatus.OCCUPIED;
        }
        else if (status === client_1.OrderStatus.CANCELLED) {
            // Check if there are other active occupied orders for this table.
            const otherOrdersCount = await db_1.prisma.order.count({
                where: {
                    tableId: order.tableId,
                    restaurantId,
                    status: { in: [client_1.OrderStatus.PENDING, client_1.OrderStatus.ACCEPTED, client_1.OrderStatus.PREPARING, client_1.OrderStatus.COOKING, client_1.OrderStatus.PACKING, client_1.OrderStatus.READY] },
                    id: { not: id },
                },
            });
            if (otherOrdersCount === 0) {
                tableStatusUpdate = client_1.TableStatus.AVAILABLE;
            }
        }
        if (tableStatusUpdate) {
            const updatedTable = await db_1.prisma.table.update({
                where: { id: order.tableId },
                data: { status: tableStatusUpdate },
            });
            // Notify staff about table status change
            (0, socket_1.notifyStaff)(restaurantId, 'table:update', { action: 'update', table: updatedTable });
        }
        // Write Activity Log
        await db_1.prisma.activityLog.create({
            data: {
                action: 'Order Updated',
                details: `Order ${order.shortId} status changed from ${previousStatus} to ${status}`,
                restaurantId,
            },
        });
        // Real-time notifications:
        // 1. Notify the specific Customer tracking screen
        (0, socket_1.notifyOrderUpdate)(id, 'order:status_change', { status });
        // 2. Notify other staff dashboard instances
        (0, socket_1.notifyStaff)(restaurantId, 'order:update', updatedOrder);
        return res.json({ order: updatedOrder });
    }
    catch (error) {
        console.error('Update status error:', error);
        return res.status(500).json({ error: 'Server error updating order status' });
    }
};
exports.updateOrderStatus = updateOrderStatus;
