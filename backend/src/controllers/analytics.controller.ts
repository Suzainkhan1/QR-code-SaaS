import { Response } from 'express';
import { prisma } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

export const getAnalytics = async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = req.user?.restaurantId;
  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized context' });

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Time-bound window for heavy aggregations (prevents unbounded growth).
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // ───────────────────────────────────────────────────────────
    // PHASE 1: Fire ALL independent queries in parallel.
    // Previously these ran sequentially (11 awaits in a row).
    // ───────────────────────────────────────────────────────────
    const [
      todayOrdersCount,
      pendingOrdersCount,
      todayBillsSum,
      overallBillsSum,
      overallExpensesSum,
      rawMaterialExpensesSum,
      orderItems,
      categories,
      recentOrders,
      closedSessions,
      completedOrders,
      allPaidBills,       // Single query replaces two separate bill queries
    ] = await Promise.all([
      // 1. Today's order count
      prisma.order.count({
        where: {
          restaurantId,
          createdAt: { gte: todayStart },
          status: { not: 'CANCELLED' },
        },
      }),

      // 2. Pending orders count
      prisma.order.count({
        where: {
          restaurantId,
          status: { in: ['PENDING', 'ACCEPTED', 'PREPARING', 'COOKING', 'PACKING', 'READY'] },
        },
      }),

      // 3. Today's revenue
      prisma.bill.aggregate({
        where: {
          restaurantId,
          isPaid: true,
          paidAt: { gte: todayStart },
        },
        _sum: { grandTotal: true },
      }),

      // 4. Overall revenue
      prisma.bill.aggregate({
        where: {
          restaurantId,
          isPaid: true,
        },
        _sum: { grandTotal: true },
        _count: { id: true },
      }),

      // 5. Overall expenses
      prisma.expense.aggregate({
        where: { restaurantId },
        _sum: { amount: true },
      }),

      // 6. Raw material expenses
      prisma.expense.aggregate({
        where: { restaurantId, category: 'Raw Materials' },
        _sum: { amount: true },
      }),

      // 7. Order items for best-sellers (bounded to 90 days)
      prisma.orderItem.findMany({
        where: {
          order: {
            restaurantId,
            status: { not: 'CANCELLED' },
            createdAt: { gte: ninetyDaysAgo },
          },
        },
        include: { menuItem: { select: { id: true, name: true } } },
      }),

      // 8. Categories for sales distribution
      prisma.menuCategory.findMany({
        where: { restaurantId },
        include: { items: { select: { id: true } } },
      }),

      // 9. Recent orders for peak hours (30 days)
      prisma.order.findMany({
        where: {
          restaurantId,
          status: { not: 'CANCELLED' },
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { createdAt: true },
      }),

      // 10. Closed sessions for turnover (bounded to 90 days)
      prisma.tableSession.findMany({
        where: {
          restaurantId,
          isActive: false,
          createdAt: { gte: ninetyDaysAgo },
        },
        select: { createdAt: true, updatedAt: true },
      }),

      // 11. Completed orders for prep time (bounded to 90 days)
      prisma.order.findMany({
        where: {
          restaurantId,
          status: { in: ['READY', 'DELIVERED'] },
          createdAt: { gte: ninetyDaysAgo },
        },
        select: { createdAt: true, updatedAt: true },
      }),

      // 12. All paid bills for daily + monthly trend graphs (single query)
      prisma.bill.findMany({
        where: { restaurantId, isPaid: true },
        select: { grandTotal: true, createdAt: true },
      }),
    ]);

    // ───────────────────────────────────────────────────────────
    // PHASE 2: In-memory computation (fast, no more DB round-trips)
    // ───────────────────────────────────────────────────────────

    const todayRevenue = todayBillsSum._sum.grandTotal || 0;
    const totalRevenue = overallBillsSum._sum.grandTotal || 0;
    const totalPaidOrdersCount = overallBillsSum._count.id || 0;
    const averageOrderValue = totalPaidOrdersCount > 0 ? Math.round(totalRevenue / totalPaidOrdersCount) : 0;
    const totalExpenses = overallExpensesSum._sum.amount || 0;
    const rawMaterialExpenses = rawMaterialExpensesSum._sum.amount || 0;

    const grossProfit = Math.max(0, totalRevenue - rawMaterialExpenses);
    const netProfit = Math.max(0, totalRevenue - totalExpenses);
    const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

    // Best & Least Selling Items
    const itemSalesMap: { [key: string]: { name: string; qty: number; sales: number } } = {};
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

    // Category Sales Distribution
    const categorySalesMap: { [key: string]: number } = {};
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

    // Peak Ordering Hours
    const hourlyMap: { [key: number]: number } = {};
    for (let i = 0; i < 24; i++) hourlyMap[i] = 0;

    recentOrders.forEach((o) => {
      const hr = new Date(o.createdAt).getHours();
      hourlyMap[hr] = (hourlyMap[hr] || 0) + 1;
    });

    const peakHours = Object.entries(hourlyMap).map(([hour, count]) => ({
      hour: `${hour.padStart(2, '0')}:00`,
      count,
    }));

    // Average Table Turnover Time
    let totalDurationMs = 0;
    closedSessions.forEach((s) => {
      totalDurationMs += new Date(s.updatedAt).getTime() - new Date(s.createdAt).getTime();
    });
    const averageTurnoverTime = closedSessions.length > 0 ? Math.round(totalDurationMs / closedSessions.length / 60000) : 45;

    // Average Order Preparation Time
    let totalPrepMs = 0;
    completedOrders.forEach((o) => {
      totalPrepMs += new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime();
    });
    const averagePrepTime = completedOrders.length > 0 ? Math.round(totalPrepMs / completedOrders.length / 60000) : 15;

    // Financial Trend — 7-Day + Monthly (computed from single query)
    const dailyTrendMap: { [key: string]: number } = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
      dailyTrendMap[dateStr] = 0;
    }

    const monthlyTrendMap: { [key: string]: number } = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(now.getMonth() - i);
      const monthStr = d.toLocaleDateString('en-US', { month: 'short' });
      monthlyTrendMap[monthStr] = 0;
    }

    // Single pass over all bills populates both graphs
    allPaidBills.forEach((b) => {
      const dateStr = new Date(b.createdAt).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
      if (dailyTrendMap[dateStr] !== undefined) {
        dailyTrendMap[dateStr] += b.grandTotal;
      }

      const monthStr = new Date(b.createdAt).toLocaleDateString('en-US', { month: 'short' });
      if (monthlyTrendMap[monthStr] !== undefined) {
        monthlyTrendMap[monthStr] += b.grandTotal;
      }
    });

    const dailyRevenueGraph = Object.entries(dailyTrendMap).map(([date, revenue]) => ({
      date,
      revenue: Math.round(revenue),
    }));

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
  } catch (error) {
    console.error('Analytics fetch error:', error);
    return res.status(500).json({ error: 'Server error generating analytics report' });
  }
};
