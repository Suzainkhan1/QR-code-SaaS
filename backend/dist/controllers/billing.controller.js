"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payBill = exports.checkoutTable = exports.getTableBillSummary = void 0;
const db_1 = require("../config/db");
const enums_1 = require("../types/enums");
const socket_1 = require("../socket");
// STAFF: Get active, unpaid orders summary for a table
const getTableBillSummary = async (req, res) => {
    const { tableId } = req.params;
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId)
        return res.status(401).json({ error: 'Unauthorized context' });
    try {
        const table = await db_1.prisma.table.findFirst({
            where: { id: tableId, restaurantId },
        });
        if (!table) {
            return res.status(404).json({ error: 'Table not found' });
        }
        // Find all active orders for this table that have no bill or whose bill is unpaid
        const activeOrders = await db_1.prisma.order.findMany({
            where: {
                tableId,
                restaurantId,
                status: { not: 'CANCELLED' },
                bill: null, // Orders that are not yet billed
            },
            include: {
                items: {
                    include: { menuItem: true },
                },
            },
        });
        if (activeOrders.length === 0) {
            // Check if there is an existing unpaid bill
            const existingUnpaidBill = await db_1.prisma.bill.findFirst({
                where: {
                    restaurantId,
                    isPaid: false,
                    order: { tableId },
                },
                include: {
                    order: {
                        include: {
                            items: { include: { menuItem: true } },
                        },
                    },
                },
            });
            if (existingUnpaidBill) {
                return res.json({
                    bill: existingUnpaidBill,
                    orders: [existingUnpaidBill.order],
                    subTotal: existingUnpaidBill.subTotal,
                    tax: existingUnpaidBill.tax,
                    discount: existingUnpaidBill.discount,
                    grandTotal: existingUnpaidBill.grandTotal,
                });
            }
            return res.json({ orders: [], message: 'No active unpaid items found for this table' });
        }
        const restaurant = await db_1.prisma.restaurant.findUnique({
            where: { id: restaurantId },
        });
        // Sum details
        let subTotal = 0;
        const itemsList = [];
        activeOrders.forEach((order) => {
            order.items.forEach((item) => {
                subTotal += item.price * item.quantity;
                itemsList.push({
                    id: item.id,
                    name: item.menuItem.name,
                    quantity: item.quantity,
                    price: item.price,
                    customs: item.customs ? JSON.parse(item.customs) : null,
                });
            });
        });
        const tax = Math.round(subTotal * ((restaurant?.taxRate || 5.0) / 100) * 100) / 100;
        const grandTotal = subTotal + tax;
        return res.json({
            orders: activeOrders,
            items: itemsList,
            subTotal,
            tax,
            grandTotal,
            taxRate: restaurant?.taxRate || 5.0,
        });
    }
    catch (error) {
        console.error('Bill summary error:', error);
        return res.status(500).json({ error: 'Server error compiling table bill' });
    }
};
exports.getTableBillSummary = getTableBillSummary;
// STAFF: Generate Bill (Checkout)
const checkoutTable = async (req, res) => {
    const { tableId } = req.body;
    const { discount } = req.body; // optional discount value
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId)
        return res.status(401).json({ error: 'Unauthorized' });
    if (!tableId)
        return res.status(400).json({ error: 'Table ID is required' });
    try {
        // Gather all active orders for this table that aren't cancelled or billed
        const orders = await db_1.prisma.order.findMany({
            where: {
                tableId,
                restaurantId,
                status: { not: 'CANCELLED' },
                bill: null,
            },
        });
        if (orders.length === 0) {
            return res.status(400).json({ error: 'No active orders found to check out' });
        }
        // We merge these orders under a master order or bill the first/latest active order
        // In our simplified database schema, Bill maps 1-to-1 with an Order.
        // For tables with multiple orders, we can update the first order to contain the combined total
        // and link the Bill to it, or merge them. Let's merge them:
        // We update the main order (the first order) with the combined values, delete/cancel secondary orders, or link the bill to the latest order.
        // To make it Prisma-friendly without schema breakage, we will merge the items of all orders into the first order,
        // and delete the secondary orders, keeping the invoice linked to a single complete Order record!
        // This is a brilliant, self-healing database pattern.
        const mainOrder = orders[0];
        const secondaryOrders = orders.slice(1);
        const mergedOrder = await db_1.prisma.$transaction(async (tx) => {
            // 1. Move items of secondary orders to the main order
            for (const secOrder of secondaryOrders) {
                await tx.orderItem.updateMany({
                    where: { orderId: secOrder.id },
                    data: { orderId: mainOrder.id },
                });
                // Delete secondary order
                await tx.order.delete({
                    where: { id: secOrder.id },
                });
            }
            // 2. Recalculate main order total
            const allItems = await tx.orderItem.findMany({
                where: { orderId: mainOrder.id },
            });
            const subTotal = allItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const rest = await tx.restaurant.findUnique({ where: { id: restaurantId } });
            const taxRate = rest?.taxRate || 5.0;
            const tax = Math.round(subTotal * (taxRate / 100) * 100) / 100;
            const discountAmt = discount ? parseFloat(discount) : 0.0;
            const grandTotal = Math.max(0, subTotal + tax - discountAmt);
            const updatedOrder = await tx.order.update({
                where: { id: mainOrder.id },
                data: {
                    totalAmount: subTotal,
                    taxAmount: tax,
                    discountAmount: discountAmt,
                    grandTotal: grandTotal,
                    status: 'READY', // Move to ready/finished
                },
            });
            // 3. Generate unique invoice number
            const billCount = await tx.bill.count({ where: { restaurantId } });
            const invoiceNo = `INV-${(5001 + billCount).toString()}`;
            // 4. Create Bill record
            const bill = await tx.bill.create({
                data: {
                    invoiceNo,
                    orderId: mainOrder.id,
                    restaurantId,
                    subTotal,
                    tax,
                    discount: discountAmt,
                    grandTotal,
                    isPaid: false,
                },
            });
            // 5. Set Table status to BILLING
            const updatedTable = await tx.table.update({
                where: { id: tableId },
                data: { status: enums_1.TableStatus.BILLING },
            });
            return { bill, order: updatedOrder, table: updatedTable };
        });
        await db_1.prisma.activityLog.create({
            data: {
                action: 'Bill Generated',
                details: `Invoice ${mergedOrder.bill.invoiceNo} generated for Table ${mergedOrder.table.number}`,
                restaurantId,
            },
        });
        // Notify staff
        (0, socket_1.notifyStaff)(restaurantId, 'table:update', { action: 'update', table: mergedOrder.table });
        (0, socket_1.notifyStaff)(restaurantId, 'billing:update', { action: 'checkout', bill: mergedOrder.bill });
        return res.status(201).json(mergedOrder);
    }
    catch (error) {
        console.error('Checkout error:', error);
        return res.status(500).json({ error: 'Server error during checkout' });
    }
};
exports.checkoutTable = checkoutTable;
// STAFF: Mark Bill as Paid
const payBill = async (req, res) => {
    const { id } = req.params; // Bill ID
    const { paymentMethod } = req.body; // CASH, UPI, CARD
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId)
        return res.status(401).json({ error: 'Unauthorized' });
    if (!paymentMethod)
        return res.status(400).json({ error: 'Payment method is required' });
    try {
        const bill = await db_1.prisma.bill.findFirst({
            where: { id, restaurantId },
            include: { order: true },
        });
        if (!bill) {
            return res.status(404).json({ error: 'Bill invoice not found' });
        }
        if (bill.isPaid) {
            return res.status(400).json({ error: 'This invoice has already been paid' });
        }
        const result = await db_1.prisma.$transaction(async (tx) => {
            // 1. Mark Bill as paid
            const updatedBill = await tx.bill.update({
                where: { id },
                data: {
                    isPaid: true,
                    paymentMethod: paymentMethod,
                    paidAt: new Date(),
                },
            });
            // 2. Mark associated Order as Delivered (Completed)
            await tx.order.update({
                where: { id: bill.orderId },
                data: { status: 'DELIVERED' },
            });
            // 3. Mark Table as AVAILABLE (since bill is settled)
            const updatedTable = await tx.table.update({
                where: { id: bill.order.tableId },
                data: { status: enums_1.TableStatus.AVAILABLE },
            });
            // 4. Log Activity
            await tx.activityLog.create({
                data: {
                    action: 'Bill Settled',
                    details: `Invoice ${bill.invoiceNo} paid via ${paymentMethod}`,
                    restaurantId,
                },
            });
            return { bill: updatedBill, table: updatedTable };
        });
        // Notify staff dashboard (sync tables & financial records)
        (0, socket_1.notifyStaff)(restaurantId, 'table:update', { action: 'update', table: result.table });
        (0, socket_1.notifyStaff)(restaurantId, 'billing:update', { action: 'pay', bill: result.bill });
        return res.json({ message: 'Invoice paid and table settled successfully', ...result });
    }
    catch (error) {
        console.error('Settle bill error:', error);
        return res.status(500).json({ error: 'Server error settling bill' });
    }
};
exports.payBill = payBill;
