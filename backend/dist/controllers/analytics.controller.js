"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnalytics = void 0;
const db_1 = require("../config/db");
const getAnalytics = async (req, res) => {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId)
        return res.status(401).json({ error: 'Unauthorized context' });
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        // 1. Basic Counts
        const todayOrdersCount = await db_1.prisma.order.count({
            where: {
                restaurantId,
                createdAt: { gte: todayStart },
                status: { not: 'CANCELLED' },
            },
        });
        const pendingOrdersCount = await db_1.prisma.order.count({
            where: {
                restaurantId,
                status: { in: ['PENDING', 'ACCEPTED', 'PREPARING', 'COOKING', 'PACKING', 'READY'] },
            },
        });
        // 2. Today's Revenue (DB-side aggregation of paid bills today)
        const todayBillsSum = await db_1.prisma.bill.aggregate({
            where: {
                restaurantId,
                isPaid: true,
                paidAt: { gte: todayStart },
            },
            _sum: { grandTotal: true },
        });
        const todayRevenue = todayBillsSum._sum.grandTotal || 0;
        // 3. Overall Revenue (DB-side aggregation of all-time paid bills)
        const overallBillsSum = await db_1.prisma.bill.aggregate({
            where: {
                restaurantId,
                isPaid: true,
            },
            _sum: { grandTotal: true },
            _count: { id: true },
        });
        const totalRevenue = overallBillsSum._sum.grandTotal || 0;
        const totalPaidOrdersCount = overallBillsSum._count.id || 0;
        const averageOrderValue = totalPaidOrdersCount > 0 ? Math.round(totalRevenue / totalPaidOrdersCount) : 0;
        // 4. Expenses Aggregations (DB-side aggregations)
        const overallExpensesSum = await db_1.prisma.expense.aggregate({
            where: { restaurantId },
            _sum: { amount: true },
        });
        const totalExpenses = overallExpensesSum._sum.amount || 0;
        const rawMaterialExpensesSum = await db_1.prisma.expense.aggregate({
            where: { restaurantId, category: 'Raw Materials' },
            _sum: { amount: true },
        });
        const rawMaterialExpenses = rawMaterialExpensesSum._sum.amount || 0;
        // Financial calculations
        const grossProfit = Math.max(0, totalRevenue - rawMaterialExpenses);
        const netProfit = Math.max(0, totalRevenue - totalExpenses);
        const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;
        // 5. Best & Least Selling Items (DB query + optimized map)
        const orderItems = await db_1.prisma.orderItem.findMany({
            where: {
                order: {
                    restaurantId,
                    status: { not: 'CANCELLED' },
                },
            },
            include: { menuItem: true },
        });
        const itemSalesMap = {};
        orderItems.forEach((item) => {
            const key = item.menuItemId;
            if (!itemSalesMap[key]) {
                itemSalesMap[key] = { name: item.menuItem.name, qty: 0, sales: 0 };
            }
            itemSalesMap[key].qty += item.quantity;
            itemSalesMap[key].sales += item.price * item.quantity;
        });
        const salesArray = Object.values(itemSalesMap);
        const topSellingItems = [...salesArray].sort((a, b) => b.qty - a.qty).slice(0, 5);
        const leastSellingItems = [...salesArray].sort((a, b) => a.qty - b.qty).slice(0, 5);
        // 6. Category Sales Distribution
        const categorySalesMap = {};
        const categories = await db_1.prisma.menuCategory.findMany({
            where: { restaurantId },
            include: { items: true },
        });
        categories.forEach((cat) => {
            categorySalesMap[cat.name] = 0;
            cat.items.forEach((item) => {
                const itemSales = itemSalesMap[item.id];
                if (itemSales) {
                    categorySalesMap[cat.name] += itemSales.sales;
                }
            });
        });
        const categorySales = Object.entries(categorySalesMap).map(([name, value]) => ({
            name,
            value,
        }));
        // 7. Peak Ordering Hours (Last 30 days for high performance)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentOrders = await db_1.prisma.order.findMany({
            where: {
                restaurantId,
                status: { not: 'CANCELLED' },
                createdAt: { gte: thirtyDaysAgo },
            },
            select: { createdAt: true },
        });
        const hourlyMap = {};
        for (let i = 0; i < 24; i++)
            hourlyMap[i] = 0;
        recentOrders.forEach((o) => {
            const hr = new Date(o.createdAt).getHours();
            hourlyMap[hr] = (hourlyMap[hr] || 0) + 1;
        });
        const peakHours = Object.entries(hourlyMap).map(([hour, count]) => ({
            hour: `${hour.padStart(2, '0')}:00`,
            count,
        }));
        // 8. Average Table Turnover Time (Session duration in minutes)
        const closedSessions = await db_1.prisma.tableSession.findMany({
            where: { restaurantId, isActive: false },
            select: { createdAt: true, updatedAt: true },
        });
        let totalDurationMs = 0;
        closedSessions.forEach((s) => {
            totalDurationMs += new Date(s.updatedAt).getTime() - new Date(s.createdAt).getTime();
        });
        const averageTurnoverTime = closedSessions.length > 0 ? Math.round(totalDurationMs / closedSessions.length / 60000) : 45;
        // 9. Average Order Preparation Time (Pending -> Ready/Delivered in minutes)
        const completedOrders = await db_1.prisma.order.findMany({
            where: {
                restaurantId,
                status: { in: ['READY', 'DELIVERED'] },
            },
            select: { createdAt: true, updatedAt: true },
        });
        let totalPrepMs = 0;
        completedOrders.forEach((o) => {
            totalPrepMs += new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime();
        });
        const averagePrepTime = completedOrders.length > 0 ? Math.round(totalPrepMs / completedOrders.length / 60000) : 15;
        // 10. Financial Trend (Last 7 Days Sales Graph Data)
        const dailyTrendMap = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
            dailyTrendMap[dateStr] = 0;
        }
        const recentPaidBills = await db_1.prisma.bill.findMany({
            where: {
                restaurantId,
                isPaid: true,
                createdAt: { gte: thirtyDaysAgo },
            },
            select: { grandTotal: true, createdAt: true },
        });
        recentPaidBills.forEach((b) => {
            const dateStr = new Date(b.createdAt).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
            if (dailyTrendMap[dateStr] !== undefined) {
                dailyTrendMap[dateStr] += b.grandTotal;
            }
        });
        const dailyRevenueGraph = Object.entries(dailyTrendMap).map(([date, revenue]) => ({
            date,
            revenue: Math.round(revenue),
        }));
        // 11. Monthly Financial Trend (Last 6 Months Sales Graph Data)
        const monthlyTrendMap = {};
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(now.getMonth() - i);
            const monthStr = d.toLocaleDateString('en-US', { month: 'short' });
            monthlyTrendMap[monthStr] = 0;
        }
        const allPaidBillsTime = await db_1.prisma.bill.findMany({
            where: { restaurantId, isPaid: true },
            select: { grandTotal: true, createdAt: true },
        });
        allPaidBillsTime.forEach((b) => {
            const monthStr = new Date(b.createdAt).toLocaleDateString('en-US', { month: 'short' });
            if (monthlyTrendMap[monthStr] !== undefined) {
                monthlyTrendMap[monthStr] += b.grandTotal;
            }
        });
        const monthlyRevenueGraph = Object.entries(monthlyTrendMap).map(([month, revenue]) => ({
            month,
            revenue: Math.round(revenue),
        }));
        return res.json({
            summary: {
                todayOrders: todayOrdersCount,
                todayRevenue: Math.round(todayRevenue),
                pendingOrders: pendingOrdersCount,
                averageOrderValue: Math.round(averageOrderValue),
                grossProfit: Math.round(grossProfit),
                netProfit: Math.round(netProfit),
                profitMargin,
                totalRevenue: Math.round(totalRevenue),
                totalExpenses: Math.round(totalExpenses),
                averageTurnoverTime,
                averagePrepTime,
            },
            topSellingItems,
            leastSellingItems,
            categorySales,
            peakHours,
            dailyRevenueGraph,
            monthlyRevenueGraph,
        });
    }
    catch (error) {
        console.error('Analytics fetch error:', error);
        return res.status(500).json({ error: 'Server error generating analytics report' });
    }
};
exports.getAnalytics = getAnalytics;
