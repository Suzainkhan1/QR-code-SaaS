import { Response } from 'express';
import { prisma } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

export const getAnalytics = async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = req.user?.restaurantId;
  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized context' });

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Basic Counts
    const todayOrdersCount = await prisma.order.count({
      where: {
        restaurantId,
        createdAt: { gte: todayStart },
        status: { not: 'CANCELLED' },
      },
    });

    const pendingOrdersCount = await prisma.order.count({
      where: {
        restaurantId,
        status: { in: ['PENDING', 'ACCEPTED', 'PREPARING', 'COOKING', 'PACKING', 'READY'] },
      },
    });

    // 2. Today's Revenue (grand total of bills paid today)
    const todayBills = await prisma.bill.findMany({
      where: {
        restaurantId,
        isPaid: true,
        paidAt: { gte: todayStart },
      },
      select: { grandTotal: true },
    });
    const todayRevenue = todayBills.reduce((sum, b) => sum + b.grandTotal, 0);

    // 3. Overall Revenue (all time paid bills)
    const allPaidBills = await prisma.bill.findMany({
      where: { restaurantId, isPaid: true },
      select: { grandTotal: true, subTotal: true, discount: true, createdAt: true },
    });
    const totalRevenue = allPaidBills.reduce((sum, b) => sum + b.grandTotal, 0);

    // 4. Expenses Aggregations
    const allExpenses = await prisma.expense.findMany({
      where: { restaurantId },
      select: { amount: true, category: true },
    });
    const totalExpenses = allExpenses.reduce((sum, e) => sum + e.amount, 0);
    const rawMaterialExpenses = allExpenses
      .filter((e) => e.category === 'Raw Materials')
      .reduce((sum, e) => sum + e.amount, 0);

    // Calculations
    const grossProfit = Math.max(0, totalRevenue - rawMaterialExpenses);
    const netProfit = Math.max(0, totalRevenue - totalExpenses);
    const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

    const totalPaidOrdersCount = allPaidBills.length;
    const averageOrderValue = totalPaidOrdersCount > 0 ? Math.round(totalRevenue / totalPaidOrdersCount) : 0;

    // 5. Best & Least Selling Items
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          restaurantId,
          status: { not: 'CANCELLED' },
        },
      },
      include: { menuItem: true },
    });

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

    // 6. Category Sales Distribution
    const categorySalesMap: { [key: string]: number } = {};
    const categories = await prisma.menuCategory.findMany({
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

    // 7. Peak Ordering Hours (Group by hour)
    const allOrders = await prisma.order.findMany({
      where: { restaurantId, status: { not: 'CANCELLED' } },
      select: { createdAt: true },
    });

    const hourlyMap: { [key: number]: number } = {};
    for (let i = 0; i < 24; i++) hourlyMap[i] = 0;

    allOrders.forEach((o) => {
      const hr = new Date(o.createdAt).getHours();
      hourlyMap[hr] = (hourlyMap[hr] || 0) + 1;
    });

    const peakHours = Object.entries(hourlyMap).map(([hour, count]) => ({
      hour: `${hour.padStart(2, '0')}:00`,
      count,
    }));

    // 8. Financial Trend (Last 7 Days Sales Graph Data)
    const dailyTrendMap: { [key: string]: number } = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
      dailyTrendMap[dateStr] = 0;
    }

    allPaidBills.forEach((b) => {
      const dateStr = new Date(b.createdAt).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
      if (dailyTrendMap[dateStr] !== undefined) {
        dailyTrendMap[dateStr] += b.grandTotal;
      }
    });

    const dailyRevenueGraph = Object.entries(dailyTrendMap).map(([date, revenue]) => ({
      date,
      revenue: Math.round(revenue),
    }));

    // 9. Monthly Financial Trend (Last 6 Months Sales Graph Data)
    const monthlyTrendMap: { [key: string]: number } = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(now.getMonth() - i);
      const monthStr = d.toLocaleDateString('en-US', { month: 'short' });
      monthlyTrendMap[monthStr] = 0;
    }

    allPaidBills.forEach((b) => {
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
